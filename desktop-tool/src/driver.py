import datetime as dt
import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from functools import cached_property
from pathlib import Path
from typing import Any, Generator, Optional

import attr
import enlighten
from selenium.common import exceptions as sl_exc
from selenium.common.exceptions import (
    NoAlertPresentException,
    NoSuchElementException,
    NoSuchWindowException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.expected_conditions import invisibility_of_element
from selenium.webdriver.support.ui import Select, WebDriverWait

from src.constants import THREADS, Browsers, Cardstocks, States, TargetSites
from src.exc import InvalidStateException
from src.order import CardImage, CardImageCollection, CardOrder
from src.processing import ImagePostProcessingConfig
from src.utils import (
    alert_handler,
    bold,
    exception_retry_skip_handler,
    log_hours_minutes_seconds_elapsed,
)


@attr.s
class AutofillDriver:
    driver: WebDriver = attr.ib(default=None)  # delay initialisation until XML is selected and parsed
    browser: Browsers = attr.ib(default=Browsers.chrome)
    binary_location: Optional[str] = attr.ib(default=None)  # path to browser executable
    target_site: TargetSites = attr.ib(default=TargetSites.MakePlayingCards)
    headless: bool = attr.ib(default=False)
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
            driver = self.browser.value(headless=self.headless, binary_location=self.binary_location)
            driver.set_window_size(1200, 900)
            driver.implicitly_wait(5)
            print(
                f"Successfully initialised {bold(self.browser.name)} driver "
                f"targeting {bold(self.target_site.name)}."
            )
        except (AttributeError, ValueError, sl_exc.WebDriverException) as e:
            raise Exception(
                f"An error occurred while attempting to configure the webdriver for your specified browser. "
                f"Please make sure you have installed the browser & that it is up to date:\n\n{bold(e)}"
            )

        self.driver = driver

    def configure_bars(self) -> None:
        num_images = len(self.order.fronts.cards) + len(self.order.backs.cards)
        status_format = "State: {state}, Action: {action}"
        self.status_bar = self.manager.status_bar(
            status_format=status_format, state=bold(self.state), action=bold("N/A"), position=1, autorefresh=True
        )
        self.download_bar = self.manager.counter(
            total=num_images, desc="Images Downloaded", position=2, autorefresh=True
        )
        self.upload_bar = self.manager.counter(total=num_images, desc="Images Uploaded", position=3, autorefresh=True)

        self.status_bar.refresh()
        self.download_bar.refresh()
        self.upload_bar.refresh()

    def __attrs_post_init__(self) -> None:
        self.configure_bars()
        self.order.print_order_overview()
        self.initialise_driver()
        self.driver.get(f"{self.target_site.value.starting_url}")
        self.set_state(States.defining_order)

    @cached_property
    def project_name(self) -> str:
        """
        Format the name of `self.order` such that it's suitable for naming a project with.
        Project names in the MakePlayingCards family of sites seem to have a maximum length of 32 characters.
        We chop off the appropriate amount of `self.order.name` such that we can still include today's date in the name.
        """

        today = dt.date.today().strftime("%Y-%m-%d")
        max_project_name_length = 32 - 1 - len(today)  # include a space
        project_name = Path(self.order.name).stem if self.order.name is not None else "Project"
        if len(project_name) > max_project_name_length:
            project_name = project_name[0 : max_project_name_length - 3] + "..."
        return f"{project_name} {today}"

    # endregion

    # region utils

    @alert_handler
    def switch_to_default_content(self) -> None:
        self.driver.switch_to.default_content()

    @alert_handler
    @exception_retry_skip_handler
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
            self.switch_to_default_content()

    @alert_handler
    @exception_retry_skip_handler
    def wait(self) -> None:
        """
        Wait until the loading circle in the targeted site disappears.
        """

        try:
            wait_elem = self.driver.find_element(by=By.ID, value="sysdiv_wait")
            # Wait for the element to become invisible
            while True:
                try:
                    WebDriverWait(self.driver, 100, poll_frequency=0.1).until(invisibility_of_element(wait_elem))
                except sl_exc.TimeoutException:
                    continue
                break
        except (sl_exc.NoSuchElementException, sl_exc.NoSuchFrameException, sl_exc.WebDriverException):
            return

    def set_state(self, state: str, action: Optional[str] = None) -> None:
        self.state = state
        self.action = action
        self.status_bar.update(state=bold(self.state), action=bold(self.action or "N/A"))
        self.status_bar.refresh()

    def assert_state(self, expected_state: States) -> None:
        if self.state != expected_state:
            raise InvalidStateException(expected_state, self.state)

    @alert_handler
    @exception_retry_skip_handler
    def execute_javascript(self, js: str, return_: bool = False) -> Any:
        """
        Executes the given JavaScript command in self.driver
        This can occasionally fail - e.g.
        "selenium.common.exceptions.JavaScriptException: Message: javascript error: setMode is not defined"
        """

        return self.driver.execute_script(f"javascript:{'return ' if return_ else ''}{js}")  # type: ignore

    def wait_until_javascript_object_is_defined(self, function: str) -> None:
        """
        Depending on the order of operations in the targeted site's project editor, some JavaScript functions
        can occasionally not be loaded by the time we want to execute them.
        This mostly happens when continuing an existing project with --skipsetup.
        This function works around this issue by pausing the program execution until required JavaScript functions
        are loaded.
        """

        t = time.time()
        while True:
            if t > 10:
                return
            try:
                assert self.execute_javascript(f"typeof {function} == undefined", return_=True) is True
                return
            except (AssertionError, sl_exc.JavascriptException):
                print(f"in the loop on {function}")
                time.sleep(0.5)

    @exception_retry_skip_handler
    def next_step(self) -> None:
        """
        Page through to the next step in the targeted site.
        """

        self.wait()
        self.wait_until_javascript_object_is_defined("oDesign.setNextStep")
        self.execute_javascript("oDesign.setNextStep();")

    @alert_handler
    @exception_retry_skip_handler
    def different_images(self) -> None:
        """
        Sets each card in the current face to use different images.
        """

        self.wait_until_javascript_object_is_defined("setMode")
        self.wait_until_javascript_object_is_defined("oRenderFeature")  # looks weird but it goes
        self.execute_javascript("setMode('ImageText', 0);")

    @alert_handler
    @exception_retry_skip_handler
    def same_images(self) -> None:
        """
        Sets each card in the current face to use the same image.
        """

        self.wait_until_javascript_object_is_defined("setMode")
        self.wait_until_javascript_object_is_defined("oRenderFeature")  # looks weird but it goes
        self.execute_javascript("setMode('ImageText', 1);")

    @exception_retry_skip_handler
    def is_image_currently_uploading(self) -> bool:
        self.wait_until_javascript_object_is_defined("oDesignImage.UploadStatus")
        return self.execute_javascript("oDesignImage.UploadStatus == 'Uploading'", return_=True) is True

    @exception_retry_skip_handler
    def get_element_for_slot_js(self, slot: int) -> str:
        self.wait_until_javascript_object_is_defined("PageLayout.prototype.getElement3")
        return f'PageLayout.prototype.getElement3("dnImg", "{slot}")'

    @exception_retry_skip_handler
    def get_ssid(self) -> Optional[str]:
        try:
            return self.driver.current_url.split("?ssid=")[1]
        except IndexError:
            return None

    @exception_retry_skip_handler
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

    @exception_retry_skip_handler
    def is_slot_filled(self, slot: int) -> bool:
        self.wait_until_javascript_object_is_defined("PageLayout.prototype.checkEmptyImage")
        return not self.execute_javascript(
            f"PageLayout.prototype.checkEmptyImage({self.get_element_for_slot_js(slot)})", return_=True
        )

    @exception_retry_skip_handler
    def get_all_uploaded_image_pids(self) -> list[str]:
        self.wait_until_javascript_object_is_defined("oDesignImage.dn_getImageList")
        if pid_string := self.execute_javascript("oDesignImage.dn_getImageList()", return_=True):
            return pid_string.split(";")
        return []

    def get_number_of_uploaded_images(self) -> int:
        return len(self.get_all_uploaded_image_pids())

    @exception_retry_skip_handler
    def attempt_to_upload_image(self, image: CardImage) -> None:
        """
        A single attempt at uploading `image` to the targeted site.
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

    @exception_retry_skip_handler
    def upload_image(self, image: CardImage, max_tries: int = 3) -> Optional[str]:
        """
        Uploads the given CardImage with `max_tries` attempts. Returns the image's PID in the targeted site.
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
                        f"Attempted to upload image {bold(image.name)} {max_tries} times, "
                        f"but no attempt succeeded! Skipping this image."
                    )
                    return None
        else:
            print(f"Image {bold(image.name)} at path {bold(image.file_path or 'None')} does not exist!")
            return None

    @exception_retry_skip_handler
    def insert_image(self, pid: Optional[str], image: CardImage, slots: Optional[list[int]] = None) -> None:
        """
        Inserts the image identified by `pid` into `image.slots`.
        If `slots` is specified, fill the image into those slots instead.
        """

        self.wait_until_javascript_object_is_defined("PageLayout.prototype.applyDragPhoto")

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

    @exception_retry_skip_handler
    def upload_and_insert_image(self, image: CardImage) -> bool:
        """
        Uploads and inserts `image` into the targeted site.
        How this is executed depends on whether the image has already been fully or partially uploaded,
        or not uploaded at all:
        * None of the image's slots filled - upload the image and insert it into all slots
        * Some of the image's slots filled - fill the unfilled slots with the image in the first filled
        * All of the image's slots filled - no action required
        Returns whether any action to modify the targeted site's project state was taken.
        """

        slots_filled = [self.is_slot_filled(slot) for slot in image.slots]
        if all(slots_filled):
            return False
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
        return True

    @exception_retry_skip_handler
    def upload_and_insert_images(self, images: CardImageCollection, auto_save_threshold: Optional[int]) -> None:
        image_count = len(images.cards)
        for i in range(image_count):
            image: CardImage = images.queue.get()
            if image.downloaded:
                project_mutated = self.upload_and_insert_image(image)
                if (
                    auto_save_threshold is not None
                    and project_mutated
                    and ((i % auto_save_threshold) == (auto_save_threshold - 1) or i == (image_count - 1))
                ):
                    self.save_project_to_user_account()
            self.upload_bar.update()

    # endregion

    # region authentication

    @exception_retry_skip_handler
    def is_user_authenticated(self) -> bool:
        return len(self.driver.find_elements(By.XPATH, f'//a[@href="{self.target_site.value.logout_url}"]')) == 1

    @exception_retry_skip_handler
    def authenticate(self) -> None:
        action = self.action
        self.driver.get(f"{self.target_site.value.login_url}")
        self.set_state(States.defining_order, "Awaiting user sign-in")
        input(
            textwrap.dedent(
                f"""
                The specified inputs require you to sign into your {bold(self.target_site.name)} account.
                Please sign in, then return to the console window and press Enter.
                """
            )
        )
        while not self.is_user_authenticated():
            input(
                textwrap.dedent(
                    """
                    It looks like you're not signed in.
                    Please sign in, then return to the console window and press Enter.
                    """
                )
            )
        print("Successfully signed in!")
        self.set_state(States.defining_order, action)
        self.driver.get(f"{self.target_site.value.starting_url}")

    # endregion

    # region project management

    @exception_retry_skip_handler
    def define_project(self) -> None:
        self.assert_state(States.defining_order)
        # Select card stock
        stock_to_select = self.target_site.value.cardstock_site_name_mapping[Cardstocks(self.order.details.stock)]
        stock_dropdown = Select(
            self.driver.find_element(by=By.ID, value=self.target_site.value.cardstock_dropdown_element_id)
        )
        stock_dropdown.select_by_visible_text(stock_to_select)

        # Select number of cards
        qty_dropdown = Select(
            self.driver.find_element(by=By.ID, value=self.target_site.value.quantity_dropdown_element_id)
        )
        qty_dropdown.select_by_value(str(self.order.details.bracket))

        # Switch the finish to foil if the user ordered foil cards
        if self.order.details.foil:
            if self.target_site.value.supports_foil:
                foil_dropdown = Select(
                    self.driver.find_element(by=By.ID, value=self.target_site.value.print_type_dropdown_element_id)
                )
                foil_dropdown.select_by_value(self.target_site.value.foil_dropdown_element_value)
            else:
                print(
                    textwrap.dedent(
                        f"""
                        {bold('WARNING')}: Your project is configured to be printed in foil,
                        but {bold(self.target_site.name)} does not support foil printing.
                        {bold('Your project will be auto-filled as non-foil.')}
                        """
                    )
                )

        self.set_state(States.paging_to_fronts)

    @alert_handler
    @exception_retry_skip_handler
    def redefine_project(self) -> None:
        """
        Called when continuing to edit an existing project in the targeted site.
        Ensures that the project's size and bracket align with the order's size and bracket.
        """

        self.set_state(States.defining_order, "Awaiting user input")
        self.driver.get(f"{self.target_site.value.saved_projects_url}")
        input(
            textwrap.dedent(
                """
                Continuing to edit an existing order. Please enter the project editor for your selected project,
                then return to the console window and press Enter.
                """
            )
        )
        while (ssid := self.get_ssid()) is None:
            input(
                textwrap.dedent(
                    "The SSID of the project cannot be determined from the current URL. "
                    "Are you sure you're in the project editor?"
                    "Please enter the editor for your selected project, "
                    "then return to the console window and press Enter."
                )
            )
        print("Successfully entered the editor for an existing project!")
        self.set_state(States.defining_order, "Configuring order")

        # navigate to insert fronts page
        self.execute_javascript(f"oTrackerBar.setFlow('{self.target_site.value.insert_fronts_url}?ssid={ssid}');")
        self.wait()

        self.wait_until_javascript_object_is_defined("PageLayout.prototype.renderDesignCount")
        self.execute_javascript("PageLayout.prototype.renderDesignCount()")
        with self.switch_to_frame("sysifm_loginFrame"):
            self.wait_until_javascript_object_is_defined("displayTotalCount")
            self.execute_javascript("displayTotalCount()")  # display the dropdown for "up to N cards"
            qty_dropdown = Select(self.driver.find_element(by=By.ID, value="dro_total_count"))
            qty_dropdown.select_by_value(str(self.order.details.bracket))
            qty = self.driver.find_element(by=By.ID, value="txt_card_number")
            qty.clear()
            qty.send_keys(str(self.order.details.quantity))
            self.different_images()
        self.wait()
        self.set_state(States.inserting_fronts)

    @exception_retry_skip_handler
    def save_project_to_user_account(self) -> None:
        self.set_state(self.state, f"Saving project to {self.target_site.name} account")
        project_name_element = self.driver.find_element(by=By.ID, value="txt_temporaryname")
        if project_name_element.text != self.project_name:
            project_name_element.clear()
            project_name_element.send_keys(self.project_name)
        self.wait_until_javascript_object_is_defined("oDesign.setTemporarySave")
        self.execute_javascript("oDesign.setTemporarySave();")
        self.wait()

    # endregion

    # region insert fronts

    @exception_retry_skip_handler
    def page_to_fronts(self) -> None:
        self.assert_state(States.paging_to_fronts)

        # reset this between fronts and backs
        self.file_path_to_pid_map = {}

        # Accept current settings and move to next step
        self.wait_until_javascript_object_is_defined("doPersonalize")
        self.execute_javascript(f"doPersonalize('{self.target_site.value.accept_settings_url}');")

        # Set the desired number of cards, then move to the next step
        with self.switch_to_frame("sysifm_loginFrame"):
            qty = self.driver.find_element(by=By.ID, value="txt_card_number")
            qty.clear()
            qty.send_keys(str(self.order.details.quantity))
            self.different_images()

        self.set_state(States.inserting_fronts)

    @exception_retry_skip_handler
    def insert_fronts(self, auto_save_threshold: Optional[int]) -> None:
        self.assert_state(States.inserting_fronts)
        self.upload_and_insert_images(self.order.fronts, auto_save_threshold=auto_save_threshold)

        self.set_state(States.paging_to_backs)

    # endregion

    # region insert backs

    @exception_retry_skip_handler
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
            self.wait_until_javascript_object_is_defined("PageLayout.prototype.renderDesignCount")
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
        self.set_state(States.inserting_backs)

    def insert_backs(self, auto_save_threshold: Optional[int]) -> None:
        self.assert_state(States.inserting_backs)
        self.upload_and_insert_images(self.order.backs, auto_save_threshold=auto_save_threshold)

        self.set_state(States.paging_to_review)

    # endregion

    # region review

    def page_to_review(self) -> None:
        self.assert_state(States.paging_to_review)

        self.next_step()
        self.next_step()

        self.set_state(States.finished)

    # endregion

    # region public

    def execute(
        self,
        skip_setup: bool,
        auto_save_threshold: Optional[int],
        post_processing_config: Optional[ImagePostProcessingConfig],
    ) -> None:
        t = time.time()
        with ThreadPoolExecutor(max_workers=THREADS) as pool:
            self.order.fronts.download_images(
                pool=pool, download_bar=self.download_bar, post_processing_config=post_processing_config
            )
            self.order.backs.download_images(
                pool=pool, download_bar=self.download_bar, post_processing_config=post_processing_config
            )
            if any([skip_setup is True, auto_save_threshold is not None]):
                self.authenticate()

            if skip_setup:
                self.redefine_project()

            else:
                print(
                    textwrap.dedent(
                        f"""
                        Configuring a new order. If you'd like to continue uploading cards to an existing project,
                        start the program and answer with {bold('Y')} when asked whether project setup should
                        be skipped.
                        """
                    )
                )
                self.define_project()
                self.page_to_fronts()
            self.insert_fronts(auto_save_threshold)
            self.page_to_backs(skip_setup)
            self.insert_backs(auto_save_threshold)
            self.page_to_review()
        log_hours_minutes_seconds_elapsed(t)
        input(
            textwrap.dedent(
                f"""
                Please review your order and ensure everything has been uploaded correctly before finalising with
                {self.target_site.name}. If any images failed to download, links to download them will have been printed
                above. If you need to make any changes to your order, you can do so by adding it to your Saved Projects
                and editing in your normal browser. Press Enter to close this window - your browser window will remain
                open.
                """
            )
        )

    # endregion
