import os
import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

import attr
import enlighten
from selenium import webdriver
from selenium.common import exceptions as sl_exc
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.expected_conditions import \
    invisibility_of_element
from selenium.webdriver.support.ui import Select, WebDriverWait
from src.constants import THREADS, States
from src.order import CardImage, CardImageCollection, CardOrder
from src.utils import (TEXT_BOLD, TEXT_END, InvalidStateException,
                       alert_handler, time_to_hours_minutes_seconds)
from webdriver_manager.chrome import ChromeDriverManager

# Disable logging messages for webdriver_manager
os.environ["WDM_LOG_LEVEL"] = "0"


@attr.s
class AutofillDriver:
    driver: webdriver.Chrome = attr.ib(default=None)  # delay initialisation until XML is selected and parsed
    starting_url: str = attr.ib(
        init=False,
        default="https://www.makeplayingcards.com/design/custom-blank-card.html",
    )
    order: CardOrder = attr.ib(default=attr.Factory(CardOrder.from_xml_in_folder))
    state: str = attr.ib(init=False, default=States.initialising)
    action: str = attr.ib(init=False, default="")
    manager: enlighten.Manager = attr.ib(init=False, default=attr.Factory(enlighten.get_manager))
    status_bar: enlighten.StatusBar = attr.ib(init=False, default=False)
    download_bar: enlighten.Counter = attr.ib(init=False, default=None)
    upload_bar: enlighten.Counter = attr.ib(init=False, default=None)

    # region initialisation
    def initialise_driver(self) -> None:
        try:
            chrome_options = Options()
            chrome_options.add_argument("--log-level=3")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-logging"])
            chrome_options.add_experimental_option("detach", True)
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
            driver.set_window_size(1200, 900)
            driver.implicitly_wait(5)
            driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
        except ValueError as e:
            raise Exception(
                f"An error occurred while attempting to configure Chrome webdriver. Please make sure you have "
                f"installed Chrome and that it is up to date: {e}"
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

    def __attrs_post_init__(self):
        self.configure_bars()
        self.initialise_driver()
        self.driver.get(self.starting_url)
        self.set_state(States.defining_order)

    # endregion

    # region utils

    @alert_handler
    def switch_to_frame(self, frame: str) -> None:
        """
        Attempts to switch to the specified frame.
        """

        try:
            self.driver.switch_to.frame(frame)
        except (sl_exc.NoSuchFrameException, sl_exc.NoSuchElementException):
            pass

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

    def set_state(self, state: str, action: str = "") -> None:
        self.state = state
        self.action = action
        self.status_bar.update(
            state=f"{TEXT_BOLD}{self.state}{TEXT_END}",  # type: ignore
            action=f"{TEXT_BOLD}{self.action or 'N/A'}{TEXT_END}",  # type: ignore
        )
        self.status_bar.refresh()

    def assert_state(self, expected_state) -> None:
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

        return self.driver.execute_script(f"javascript:{'return ' if return_ else ''}{js}")

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

    # endregion

    # region uploading
    def image_not_uploaded(self, image: CardImage) -> bool:
        # niche TODO: if you --skipsetup and insert an image into one of `image`'s slots, `image` will not be uploaded
        results = 0
        for slot in image.slots:
            xpath = f"//*[contains(@src, 'default.gif') and @index={slot}]"
            results += len(self.driver.find_elements(by=By.XPATH, value=xpath))

        return len(image.slots) == results

    def upload_image(self, image: CardImage) -> Optional[str]:
        """
        Uploads the given CardImage. Returns the image's PID in MPC.
        """

        if image.file_exists():
            self.set_state(self.state, f'Uploading "{image.name}"')

            # an image definitely shouldn't be uploading here, but doesn't hurt to make sure
            while self.execute_javascript("oDesignImage.UploadStatus == 'Uploading'", return_=True) is True:
                time.sleep(0.5)

            # upload image to mpc
            self.driver.find_element(by=By.XPATH, value='//*[@id="uploadId"]').send_keys(image.file_path)
            time.sleep(1)

            while self.execute_javascript("oDesignImage.UploadStatus == 'Uploading'", return_=True) is True:
                time.sleep(0.5)

            # return PID of last uploaded image
            return self.execute_javascript("oDesignImage.dn_getImageList()", return_=True).split(";")[-1]

        else:
            print(
                f'Image {TEXT_BOLD}"{image.name}"{TEXT_END} at path {TEXT_BOLD}{image.file_path}{TEXT_END} does '
                f"not exist!"
            )
            return None

    def insert_image(self, pid: Optional[str], image: CardImage):
        """
        Inserts the image identified by `pid` into `image.slots`.
        """

        if pid:
            self.set_state(self.state, f'Inserting "{image.name}"')
            self.execute_javascript("l = PageLayout.prototype")
            for slot in image.slots:
                # Insert the card into each slot and wait for the page to load before continuing
                self.execute_javascript(f'l.applyDragPhoto(l.getElement3("dnImg", {slot}), 0, "{pid}")')
                self.wait()
            self.set_state(self.state)

    def upload_and_insert_image(self, image: CardImage) -> None:
        if self.image_not_uploaded(image):
            pid = self.upload_image(image)
            self.insert_image(pid, image)

    def upload_and_insert_images(self, images: CardImageCollection) -> None:
        for i in range(len(images.cards)):
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

    # endregion

    # region insert fronts

    def page_to_fronts(self) -> None:
        self.assert_state(States.paging_to_fronts)

        # Accept current settings and move to next step
        self.execute_javascript(
            "doPersonalize('https://www.makeplayingcards.com/products/pro_item_process_flow.aspx');"
        )

        # Set the desired number of cards, then move to the next step
        self.switch_to_frame("sysifm_loginFrame")
        self.execute_javascript(f"document.getElementById('txt_card_number').value={self.order.details.quantity};")
        self.different_images()
        self.driver.switch_to.default_content()

        self.set_state(States.inserting_fronts)

    def insert_fronts(self) -> None:
        self.assert_state(States.inserting_fronts)
        self.upload_and_insert_images(self.order.fronts)

        self.set_state(States.paging_to_backs)

    # endregion

    # region insert backs

    def page_to_backs(self) -> None:
        self.assert_state(States.paging_to_backs)

        self.next_step()
        self.wait()
        try:
            self.driver.find_element(by=By.ID, value="closeBtn").click()
        except NoSuchElementException:
            pass
        self.next_step()

        self.switch_to_frame("sysifm_loginFrame")
        if len(self.order.backs.cards) == 1:
            # Same cardback for every card
            self.same_images()
        else:
            # Different cardbacks
            self.different_images()
        self.driver.switch_to.default_content()

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
                input(
                    textwrap.dedent(
                        """
                        Please sign in and select an existing project to continue editing. Once you've signed in, 
                        return to the script execution window and press Enter.
                        """
                    )
                )
                self.set_state(States.inserting_fronts)
            else:
                self.define_order()
                self.page_to_fronts()
            self.insert_fronts()
            self.page_to_backs()
            self.insert_backs()
            self.page_to_review()
        hours, mins, secs = time_to_hours_minutes_seconds(time.time() - t)
        print("Elapsed time: ", end="")
        if hours > 0:
            print(f"{hours} hours, ", end="")
        print(f"{mins} minutes and {secs} seconds.")
        input(
            textwrap.dedent(
                """
                Please review your order and ensure everything has been uploaded correctly before finalising with MPC.
                If you need to make any changes, you can do so by adding it to your Saved Projects and editing in your
                normal browser. Press Enter to close this window - your Chrome window will remain open.
                """
            )
        )

    # endregion
