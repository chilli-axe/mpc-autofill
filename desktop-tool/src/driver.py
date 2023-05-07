import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from typing import Any, Generator, Optional

import attr
import enlighten
from selenium import webdriver
from selenium.common import exceptions as sl_exc
from selenium.common.exceptions import (
    NoAlertPresentException,
    NoSuchElementException,
    NoSuchWindowException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support.expected_conditions import invisibility_of_element
from selenium.webdriver.support.ui import Select, WebDriverWait

from src.constants import THREADS, Browsers, States
from src.order import CardImage, CardImageCollection, CardOrder
from src.utils import (
    TEXT_BOLD,
    TEXT_END,
    InvalidStateException,
    alert_handler,
    log_hours_minutes_seconds_elapsed,
)


@attr.s
class AutofillDriver:
    driver: webdriver.remote.webdriver.WebDriver = attr.ib(
        default=None
    )  # delay initialisation until XML is selected and parsed
    browser: Browsers = attr.ib(default=Browsers.chrome)
    headless: bool = attr.ib(default=False)
    starting_url: str = attr.ib(init=False, default="https://www.makeplayingcards.com/design/custom-blank-card.html")
    order: CardOrder = attr.ib(default=attr.Factory(CardOrder.from_xml_in_folder))
    state: str = attr.ib(init=False, default=States.initialising)
    action: Optional[str] = attr.ib(init=False, default=None)
    manager: enlighten.Manager = attr.ib(init=False, default=attr.Factory(enlighten.get_manager))
    status_bar: enlighten.StatusBar = attr.ib(init=False, default=False)
    download_bar: enlighten.Counter = attr.ib(init=False, default=None)
    upload_bar: enlighten.Counter = attr.ib(init=False, default=None)
    file_path_to_pid_map: dict[str, str] = {}

    # region initialisation
    def initialise_driver(self) -> None:
        try:
            driver = self.browser.value(self.headless)
            driver.set_window_size(1200, 900)
            driver.implicitly_wait(5)
            print(f"Successfully initialised {TEXT_BOLD}{self.browser.name}{TEXT_END} driver.")
        except (ValueError, sl_exc.WebDriverException) as e:
            raise Exception(
                f"An error occurred while attempting to configure the webdriver for your specified browser. "
                f"Please make sure you have installed the browser and that it is up to date:\n\n{e}"
            )

        self.driver = driver

    def configure_bars(self) -> None:
        num_images = len(self.order.fronts.cards) + len(self.order.backs.cards)
        status_format = "State: {state}, Action: {action}"
        self.status_bar = self.manager.status_bar(
            status_format=status_format,
            state=f"{TEXT_BOLD}{self.state}{TEXT_END}",
            action=f"{TEXT_BOLD}N/A{TEXT_END}",
            position=1,
        )
        self.download_bar = self.manager.counter(total=num_images, desc="Images Downloaded", position=2)
        self.upload_bar = self.manager.counter(total=num_images, desc="Images Uploaded", position=3)

        self.status_bar.refresh()
        self.download_bar.refresh()
        self.upload_bar.refresh()

    def __attrs_post_init__(self) -> None:
        self.configure_bars()
        self.order.print_order_overview()
        self.initialise_driver()
        self.driver.get(self.starting_url)
        self.set_state(States.defining_order)

    # endregion

    # region utils

    @alert_handler
    @contextmanager
    def switch_to_frame(self, frame: str) -> Generator[None, None, None]:
        """
        Context manager for switching to `frame`.
        """

        in_frame = True
        try:
            self.driver.switch_to.frame(frame)
        except (sl_exc.NoSuchFrameException, sl_exc.NoSuchElementException):
            in_frame = False
        yield
        if in_frame:
            self.driver.switch_to.default_content()

    @alert_handler
    def wait(self) -> None:
        """
        Wait until the loading circle in MPC disappears.
        """

        try:
            wait_elem = self.driver.find_element(By.ID, value="sysdiv_wait")
            # Wait for the element to become invisible
            while True:
                try:
                    WebDriverWait(self.driver, 100).until(invisibility_of_element(wait_elem))
                except sl_exc.TimeoutException:
                    continue
                break
        except sl_exc.NoSuchElementException:
            return

    def set_state(self, state: str, action: Optional[str] = None) -> None:
        self.state = state
        self.action = action
        self.status_bar.update(
            state=f"{TEXT_BOLD}{self.state}{TEXT_END}", action=f"{TEXT_BOLD}{self.action or 'N/A'}{TEXT_END}"
        )
        self.status_bar.refresh()

    def assert_state(self, expected_state: States) -> None:
        if self.state != expected_state:
            raise InvalidStateException(expected_state, self.state)

    @alert_handler
    def execute_javascript(self, js: str, return_: bool = False) -> Any:
        """
        Executes the given JavaScript command in self.driver
        This can occasionally fail - e.g.
        "selenium.common.exceptions.JavaScriptException: Message: javascript error: setMode is not defined"
        # TODO: handle javascript errors?
        """

        return self.driver.execute_script(f"javascript:{'return ' if return_ else ''}{js}")  # type: ignore

    def next_step(self) -> None:
        """
        Page through to the next step in MPC.
        """

        self.wait()
        self.execute_javascript("oDesign.setNextStep();")

    def different_images(self) -> None:
        """
        Sets each card in the current face to use different images.
        """

        self.execute_javascript("setMode('ImageText', 0);")

    def same_images(self) -> None:
        """
        Sets each card in the current face to use the same image.
        """

        self.execute_javascript("setMode('ImageText', 1);")

    def is_image_currently_uploading(self) -> bool:
        return self.execute_javascript("oDesignImage.UploadStatus == 'Uploading'", return_=True) is True

    @staticmethod
    def get_element_for_slot_js(slot: int) -> str:
        return f'PageLayout.prototype.getElement3("dnImg", "{slot}")'

    def get_ssid(self) -> str:
        try:
            return self.driver.current_url.split("?ssid=")[1]
        except IndexError:
            raise Exception(
                "The SSID of the project cannot be determined from the current URL. "
                "Are you sure you have entered MPC's project editor?"
            )

    def handle_alert(self) -> None:
        """
        Accepts an alert if one is present.
        """

        try:
            alert = self.driver.switch_to.alert
            alert.accept()
        except NoAlertPresentException:
            pass

    # endregion

    # region uploading
    def is_slot_filled(self, slot: int) -> bool:
        return not self.execute_javascript(
            f"PageLayout.prototype.checkEmptyImage({self.get_element_for_slot_js(slot)})", return_=True
        )

    def get_all_uploaded_image_pids(self) -> list[str]:
        if pid_string := self.execute_javascript("oDesignImage.dn_getImageList()", return_=True):
            return pid_string.split(";")
        return []

    def get_number_of_uploaded_images(self) -> int:
        return len(self.get_all_uploaded_image_pids())

    def attempt_to_upload_image(self, image: CardImage) -> None:
        """
        A single attempt at uploading `image` to MPC.
        """

        # an image definitely shouldn't be uploading here, but doesn't hurt to make sure
        while self.is_image_currently_uploading():
            time.sleep(0.5)

        # send the image contents to mpc
        self.driver.find_element(by=By.ID, value="uploadId").send_keys(image.file_path)
        time.sleep(1)

        # wait for the image to finish uploading
        while self.is_image_currently_uploading():
            time.sleep(0.5)

    def upload_image(self, image: CardImage, max_tries: int = 3) -> Optional[str]:
        """
        Uploads the given CardImage with `max_tries` attempts. Returns the image's PID in MPC.
        """

        if image.file_path is not None and image.file_exists():
            if image.file_path in self.file_path_to_pid_map.keys():
                return self.file_path_to_pid_map[image.file_path]

            self.set_state(self.state, f'Uploading "{image.name}"')
            get_number_of_uploaded_images = self.get_number_of_uploaded_images()

            tries = 0
            while True:
                self.attempt_to_upload_image(image)
                if self.get_number_of_uploaded_images() > get_number_of_uploaded_images:
                    # a new image has been uploaded - assume the last image in the editor is the one we just uploaded
                    pid = self.get_all_uploaded_image_pids()[-1]
                    self.file_path_to_pid_map[image.file_path] = pid
                    return pid
                tries += 1
                if tries >= max_tries:
                    print(
                        f'Attempted to upload image {TEXT_BOLD}"{image.name}"{TEXT_END} {max_tries} times, '
                        f"but no attempt succeeded! Skipping this image."
                    )
                    return None
        else:
            print(
                f'Image {TEXT_BOLD}"{image.name}"{TEXT_END} at path {TEXT_BOLD}{image.file_path}{TEXT_END} does '
                f"not exist!"
            )
            return None

    def insert_image(self, pid: Optional[str], image: CardImage, slots: Optional[list[int]] = None) -> None:
        """
        Inserts the image identified by `pid` into `image.slots`.
        If `slots` is specified, fill the image into those slots instead.
        """

        slots_to_fill = image.slots
        if slots is not None:
            slots_to_fill = slots

        if pid:
            self.set_state(self.state, f'Inserting "{image.name}"')
            for slot in slots_to_fill:
                # Insert the card into each slot and wait for the page to load before continuing
                self.execute_javascript(
                    f'PageLayout.prototype.applyDragPhoto({self.get_element_for_slot_js(slot)}, 0, "{pid}")'
                )
                self.wait()
            self.set_state(self.state)

    def upload_and_insert_image(self, image: CardImage) -> None:
        """
        Uploads and inserts `image` into MPC. How this is executed depends on whether the image has already been fully
        or partially uploaded, on not uploaded at all:
        * None of the image's slots filled - upload the image and insert it into all slots
        * Some of the image's slots filled - fill the unfilled slots with the image in the first filled
        * All of the image's slots filled - no action required
        """

        slots_filled = [self.is_slot_filled(slot) for slot in image.slots]
        if all(slots_filled):
            return
        elif not any(slots_filled):
            pid = self.upload_image(image)
            self.insert_image(pid, image)
        else:
            idx = next(index for index, value in enumerate(slots_filled) if value is True)
            pid = self.execute_javascript(
                f'{self.get_element_for_slot_js(image.slots[idx])}.getAttribute("pid")', return_=True
            )
            unfilled_slot_numbers = [image.slots[i] for i in range(len(image.slots)) if slots_filled[i] is False]
            self.insert_image(pid, image, slots=unfilled_slot_numbers)

    def upload_and_insert_images(self, images: CardImageCollection) -> None:
        for _ in range(len(images.cards)):
            image: CardImage = images.queue.get()
            if image.downloaded:
                self.upload_and_insert_image(image)
            self.upload_bar.update()

    # endregion

    # region define order

    def define_order(self) -> None:
        self.assert_state(States.defining_order)
        # Select card stock
        stock_dropdown = Select(self.driver.find_element(by=By.ID, value="dro_paper_type"))
        stock_dropdown.select_by_visible_text(self.order.details.stock)

        # Select number of cards
        qty_dropdown = Select(self.driver.find_element(by=By.ID, value="dro_choosesize"))
        qty_dropdown.select_by_value(str(self.order.details.bracket))

        # Switch the finish to foil if the user ordered foil cards
        if self.order.details.foil:
            foil_dropdown = Select(self.driver.find_element(by=By.ID, value="dro_product_effect"))
            foil_dropdown.select_by_value("EF_055")

        self.set_state(States.paging_to_fronts)

    @alert_handler
    def redefine_order(self) -> None:
        """
        Called when continuing to edit an existing MPC project. Ensures that the MPC project's size and bracket
        align with the order's size and bracket.
        """

        self.assert_state(States.defining_order)

        # navigate to insert fronts page
        ssid = self.get_ssid()
        self.execute_javascript(
            f"oTrackerBar.setFlow('https://www.makeplayingcards.com/products/playingcard/design/dn_playingcards_front_dynamic.aspx?ssid={ssid}');"
        )
        self.wait()

        self.execute_javascript("PageLayout.prototype.renderDesignCount()")
        with self.switch_to_frame("sysifm_loginFrame"):
            self.execute_javascript("displayTotalCount()")  # display the dropdown for "up to N cards"
            qty_dropdown = Select(self.driver.find_element(by=By.ID, value="dro_total_count"))
            qty_dropdown.select_by_value(str(self.order.details.bracket))
            self.execute_javascript(f"document.getElementById('txt_card_number').value={self.order.details.quantity};")
            self.different_images()
            self.handle_alert()
        self.set_state(States.inserting_fronts)

    # endregion

    # region insert fronts

    def page_to_fronts(self) -> None:
        self.assert_state(States.paging_to_fronts)

        # reset this between fronts and backs
        self.file_path_to_pid_map = {}

        # Accept current settings and move to next step
        self.execute_javascript(
            "doPersonalize('https://www.makeplayingcards.com/products/pro_item_process_flow.aspx');"
        )

        # Set the desired number of cards, then move to the next step
        with self.switch_to_frame("sysifm_loginFrame"):
            self.execute_javascript(f"document.getElementById('txt_card_number').value={self.order.details.quantity};")
            self.different_images()

        self.set_state(States.inserting_fronts)

    def insert_fronts(self) -> None:
        self.assert_state(States.inserting_fronts)
        self.upload_and_insert_images(self.order.fronts)

        self.set_state(States.paging_to_backs)

    # endregion

    # region insert backs

    def page_to_backs(self, skip_setup: bool) -> None:
        self.assert_state(States.paging_to_backs)

        # reset this between fronts and backs
        self.file_path_to_pid_map = {}

        self.next_step()
        self.wait()
        try:
            self.driver.find_element(by=By.ID, value="closeBtn").click()
        except NoSuchElementException:
            pass
        self.next_step()

        if skip_setup:
            # bring up the dialogue for selecting same or different images
            self.wait()
            try:
                self.execute_javascript("PageLayout.prototype.renderDesignCount()")
            except sl_exc.JavascriptException:  # the dialogue has already been brought up if the above line failed
                pass
        with self.switch_to_frame("sysifm_loginFrame"):
            try:
                if len(self.order.backs.cards) == 1:
                    # Same cardback for every card
                    self.same_images()
                else:
                    # Different cardbacks
                    self.different_images()
            except NoSuchWindowException:  # TODO: investigate exactly why this happens under --skipsetup. too tired atm
                pass
            self.handle_alert()  # potential alert here from switching from same image to different images
        self.set_state(States.inserting_backs)

    def insert_backs(self) -> None:
        self.assert_state(States.inserting_backs)
        self.upload_and_insert_images(self.order.backs)

        self.set_state(States.paging_to_review)

    # endregion

    # region review

    def page_to_review(self) -> None:
        self.assert_state(States.paging_to_review)

        self.next_step()
        self.next_step()

        self.set_state(States.finished)

    # region public

    def execute(self, skip_setup: bool) -> None:
        t = time.time()
        with ThreadPoolExecutor(max_workers=THREADS) as pool:
            self.order.fronts.download_images(pool, self.download_bar)
            self.order.backs.download_images(pool, self.download_bar)

            if skip_setup:
                self.set_state(States.defining_order, "Awaiting user input")
                input(
                    textwrap.dedent(
                        f"""
                        The program has been started with {TEXT_BOLD}--skipsetup{TEXT_END}, which will continue
                        uploading cards to an existing project. Please sign in to MPC and select an existing project
                        to continue editing. Once you've signed in and have entered the MPC project editor, return to
                        the console window and press Enter.
                        """
                    )
                )
                self.redefine_order()

            else:
                print(
                    textwrap.dedent(
                        f"""
                        Configuring a new order. If you'd like to continue uploading cards to an existing project,
                        start the program with the {TEXT_BOLD}--skipsetup{TEXT_END} option (in command prompt or terminal)
                        and follow the printed instructions.

                        Windows:
                            {TEXT_BOLD}autofill-windows.exe --skipsetup{TEXT_END}
                        macOS:
                            {TEXT_BOLD}./autofill-macos --skipsetup{TEXT_END}
                        Linux:
                            {TEXT_BOLD}./autofill-linux --skipsetup{TEXT_END}
                        """
                    )
                )
                self.define_order()
                self.page_to_fronts()
            self.insert_fronts()
            self.page_to_backs(skip_setup)
            self.insert_backs()
            self.page_to_review()
        log_hours_minutes_seconds_elapsed(t)
        input(
            textwrap.dedent(
                """
                Please review your order and ensure everything has been uploaded correctly before finalising with MPC.
                If any images failed to download, links to download them will have been printed above.
                If you need to make any changes to your order, you can do so by adding it to your Saved Projects and
                editing in your normal browser. Press Enter to close this window - your Chrome window will remain open.
                """
            )
        )

    # endregion
