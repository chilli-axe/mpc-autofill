import os
import time
from typing import TYPE_CHECKING, List

import attr
from constants import Faces, States
from selenium import webdriver
from selenium.common import exceptions as sl_exc
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.expected_conditions import \
    invisibility_of_element
from selenium.webdriver.support.ui import Select, WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

if TYPE_CHECKING:
    from order import CardImage, CardImageCollection, Details, CardOrder

from utils import InvalidStateException

# Disable logging messages for webdriver_manager
os.environ["WDM_LOG_LEVEL"] = "0"


# TODO: wrapper for dismissing alerts on MPC's website (can occur if the user clicks)
# TODO: wrapper for uncaught exceptions - display the error message and prompt to press any key before closing
@attr.s
class AutofillDriver:
    driver: webdriver.Chrome = attr.ib()
    starting_url: str = attr.ib(
        default="https://www.makeplayingcards.com/design/custom-blank-card.html"
    )
    state: str = attr.ib(default=States.initialising)

    # region initialisation
    @classmethod
    def initialise(cls) -> "AutofillDriver":
        """
        Prepares self.driver by setting up Selenium options and navigating to MPC's page.
        """

        chrome_options = Options()
        chrome_options.add_argument("--log-level=3")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-logging"])
        chrome_options.add_experimental_option("detach", True)
        driver = webdriver.Chrome(
            ChromeDriverManager().install(), options=chrome_options
        )
        driver.set_window_size(1200, 900)
        driver.implicitly_wait(5)
        driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
        autofill_driver = cls(driver=driver)
        autofill_driver.driver.get(autofill_driver.starting_url)

        autofill_driver.set_state(States.defining_order)

        return autofill_driver

    # endregion

    # region public
    # Methods in this region should begin by asserting that the driver is in the state they expect, then update
    # the driver's state with wherever the program ends up after the method's logic runs.

    def define_order(self, details: "Details") -> None:
        # TODO: skip this step if resuming
        self.assert_state(States.defining_order)
        # Select card stock
        stock_dropdown = Select(self.driver.find_element_by_id("dro_paper_type"))
        stock_dropdown.select_by_visible_text(details.stock)

        # Select number of cards
        qty_dropdown = Select(self.driver.find_element_by_id("dro_choosesize"))
        qty_dropdown.select_by_value(str(details.bracket))

        # Switch the finish to foil if the user ordered foil cards
        if details.foil:
            foil_dropdown = Select(self.driver.find_element_by_id("dro_product_effect"))
            foil_dropdown.select_by_value("EF_055")

        self.set_state(States.paging_to_fronts)

    def insert_fronts(self, details: "Details", images: "CardImageCollection"):
        self.page_to_fronts(details)

        self.assert_state(States.inserting_fronts)
        self.upload_and_insert_images(images)

    # endregion

    # region transition-helpers

    def set_state(self, state: str) -> None:
        self.state = state
        # update in command line interface

    def assert_state(self, expected_state) -> None:
        if self.state != expected_state:
            raise InvalidStateException(expected_state, self.state)
            # TODO: how do we recover from here?

    def switch_to_frame(self, frame: str) -> None:
        try:
            self.driver.switch_to.frame(frame)
        except (sl_exc.NoSuchFrameException, sl_exc.NoSuchElementException):
            pass

    def wait(self) -> None:
        """
        Wait until the loading circle in MPC disappears
        """

        try:
            wait_elem = self.driver.find_element_by_id("sysdiv_wait")
            # Wait for the element to become invisible
            while True:
                try:
                    WebDriverWait(self.driver, 100).until(
                        invisibility_of_element(wait_elem)
                    )
                except sl_exc.TimeoutException:
                    continue
                break
        except sl_exc.NoSuchElementException:
            return

    def execute_javascript(self, js: str) -> None:
        """
        Executes the given JavaScript command in self.driver
        This can occasionally fail - e.g.
        "selenium.common.exceptions.JavaScriptException: Message: javascript error: setMode is not defined"
        """
        # TODO: handle javascript errors

        self.driver.execute_script(f"javascript:{js}")

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

    def page_to_fronts(self, details: "Details") -> None:
        self.assert_state(States.paging_to_fronts)

        # Accept current settings and move to next step
        self.execute_javascript(
            "doPersonalize('https://www.makeplayingcards.com/products/pro_item_process_flow.aspx');"
        )

        # Set the desired number of cards, then move to the next step
        self.switch_to_frame("sysifm_loginFrame")
        self.execute_javascript(
            f"document.getElementById('txt_card_number').value={details.quantity};"
        )
        self.different_images()
        self.driver.switch_to.default_content()

        self.set_state(States.inserting_fronts)

    # endregion

    # region uploading
    def upload_image(self, image: "CardImage") -> str:
        """
        Uploads the given CardImage.
        :param image: The CardImage to upload to MPC.
        :return: The PID of the uploaded image in MPC.
        """
        # TODO: needs overhauling
        if image.file_exists():
            num_elems = len(
                self.driver.find_elements_by_xpath("//*[contains(@id, 'upload_')]")
            )

            # if an image is uploading already, wait for it to finish uploading before continuing
            progress_container = self.driver.find_element_by_id(
                "divFileProgressContainer"
            )

            while progress_container.value_of_css_property("display") != "none":
                time.sleep(3)

            while progress_container.value_of_css_property("display") == "none":
                # Attempt to upload card until the upload progress bar appears
                self.driver.find_element_by_xpath('//*[@id="uploadId"]').send_keys(
                    image.file_path
                )
                time.sleep(1)
                progress_container = self.driver.find_element_by_id(
                    "divFileProgressContainer"
                )

            # Wait as long as necessary for the image to finish uploading
            while True:
                try:
                    # Wait until the image has finished uploading
                    elem = self.driver.find_elements_by_xpath(
                        "//*[contains(@id, 'upload_')]"
                    )
                    if len(elem) > num_elems:
                        # Return the uploaded card's PID so we can easily insert it into slots
                        return elem[-1].get_attribute("pid")

                    time.sleep(2)

                except sl_exc.UnexpectedAlertPresentException:
                    # If the user clicks on the window, alerts can pop up - we just want to dismiss these and move on
                    try:
                        alert = self.driver.switch_to.alert
                        alert.accept()
                    except sl_exc.NoAlertPresentException:
                        pass
        else:
            pass  # error queue

    def insert_image(self, pid: str, slots: List[int]):
        # TODO: needs better safeguarding against errors, and validation that the image was uploaded
        # validate that the image has been uploaded
        if pid != "":
            self.execute_javascript("l = PageLayout.prototype")
            for slot in slots:
                # Insert the card into each slot and wait for the page to load before continuing
                self.execute_javascript(
                    f'l.applyDragPhoto(l.getElement3("dnImg", {slot}), 0, "{pid}")'
                )
                self.wait()

    def upload_and_insert_image(self, image: "CardImage") -> None:
        # progress bar
        # validate that the current order face matches this image's face
        # wait until the image has been downloaded
        pid = self.upload_image(image)
        self.insert_image(pid, image.slots)

    def upload_and_insert_images(self, images: "CardImageCollection") -> None:
        # progress bar
        # TODO: pull things off the queue as they appear, and stop when all images have been downloaded & uploaded
        # for image in images.cards:
        #     self.upload_and_insert_image(image)
        pass


# endregion

# def execute(self, order: order.CardOrder):
#     # insert info, page to fronts, insert each image, page to backs, insert each image, page to final, finalise
#     # validate on final page that images have been uploaded in their correct slots
#     pass
