import datetime as dt
import logging
import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from functools import cache
from typing import Any, Generator, Optional

import attr
import enlighten
from InquirerPy import inquirer
from selenium.common import exceptions as sl_exc
from selenium.common.exceptions import (
    NoAlertPresentException,
    NoSuchElementException,
    NoSuchWindowException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.expected_conditions import (
    invisibility_of_element,
    text_to_be_present_in_element,
    visibility_of_element_located,
)
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
    # required to construct this class
    driver: WebDriver = attr.ib(default=None)  # delay initialisation until XML is selected and parsed
    browser: Browsers = attr.ib(default=Browsers.chrome)
    binary_location: Optional[str] = attr.ib(default=None)  # path to browser executable
    target_site: TargetSites = attr.ib(default=TargetSites.MakePlayingCards)
    headless: bool = attr.ib(default=False)
    starting_url: str = attr.ib(default="data:")

    # internal properties (init=False)
    state: str = attr.ib(init=False, default=States.initialising)
    action: Optional[str] = attr.ib(init=False, default=None)
    manager: enlighten.Manager = attr.ib(init=False, default=attr.Factory(enlighten.get_manager))
    status_bar: enlighten.StatusBar = attr.ib(init=False, default=False)
    order_progress_bar: enlighten.Counter = attr.ib(init=False, default=None)
    download_bar: enlighten.Counter = attr.ib(init=False, default=None)
    upload_bar: enlighten.Counter = attr.ib(init=False, default=None)
    file_path_to_pid_map: dict[str, str] = {}

    # region initialisation

    def initialise_driver(self) -> None:
        try:
            driver = self.browser.value(headless=self.headless, binary_location=self.binary_location)
            driver.set_window_size(1200, 900)
            driver.implicitly_wait(5)
            driver.get(self.starting_url)
            WebDriverWait(driver, 10).until(visibility_of_element_located((By.TAG_NAME, "body")))
            logging.info(
                f"Successfully initialised {bold(self.browser.name)} driver "
                f"targeting {bold(self.target_site.name)}.\n"
            )
        except (AttributeError, ValueError, sl_exc.WebDriverException) as e:
            raise Exception(
                f"An error occurred while attempting to configure the webdriver for your specified browser. "
                f"Please make sure you have installed the browser & that it is up to date:\n\n{bold(e)}"
            )

        self.driver = driver

    def initialise_bars(self) -> None:
        # set the total for upload/download bars to 0 here, then change the total according to each order
        # as they're processed
        status_format = "State: {state}, Action: {action}"
        self.status_bar = self.manager.status_bar(
            status_format=status_format, state=bold(self.state), action=bold("N/A"), position=1, autorefresh=True
        )
        self.order_progress_bar = self.manager.counter(
            total=0, desc="Projects Auto-Filled", position=2, autorefresh=True
        )
        self.download_bar = self.manager.counter(total=0, desc="Images Downloaded   ", position=3, autorefresh=True)
        self.upload_bar = self.manager.counter(total=0, desc="Images Uploaded     ", position=4, autorefresh=True)
        self.status_bar.refresh()
        self.order_progress_bar.refresh()
        self.download_bar.refresh()
        self.upload_bar.refresh()

    def configure_bars_for_order(self, order: CardOrder) -> None:
        num_images = len(order.fronts.cards_by_id) + len(order.backs.cards_by_id)
        self.set_state(state=States.initialising, action=None)
        self.upload_bar.total = num_images
        self.download_bar.total = num_images
        self.upload_bar.update(-self.upload_bar.count)
        self.download_bar.update(-self.download_bar.count)
        self.upload_bar.refresh()
        self.download_bar.refresh()

    def initialise_order(self, order: CardOrder) -> None:
        logging.info(f"Auto-filling {bold(order.name or 'Unnamed Project')}")
        logging.info("  " + order.get_overview())
        self.driver.get(f"{self.target_site.value.starting_url}")
        self.set_state(States.defining_order)

    def __attrs_post_init__(self) -> None:
        self.initialise_bars()
        self.initialise_driver()
        self.set_state(States.initialised)

    @staticmethod
    @cache
    def get_project_name(order_name: Optional[str]) -> str:
        """
        Format the card order's name such that it's suitable for naming a project with.
        Project names in the MakePlayingCards family of sites seem to have a maximum length of 32 characters.
        We chop off the appropriate amount of the resultant name such that we can still include today's date
        in the name.
        """

        today = dt.date.today().strftime("%Y-%m-%d")
        max_project_name_length = 32 - 1 - len(today)  # include a space
        project_name = order_name if order_name is not None else "Project"
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

        logging.debug(f"Switching to frame {frame}...")
        in_frame = True
        try:
            self.driver.switch_to.frame(frame)
            logging.debug(f"Successfully switched to frame {frame}.")
        except (sl_exc.NoSuchFrameException, sl_exc.NoSuchElementException) as e:
            in_frame = False
            logging.debug("Tried to switch to the frame but encountered an exception:")
            logging.warning(e)
        yield
        if in_frame:
            logging.debug(f"Switching out of frame {frame}.")
            self.switch_to_default_content()
        else:
            logging.debug(f"Couldn't switch to {frame} earlier so there's nothing to do here.")

    @alert_handler
    @exception_retry_skip_handler
    def wait(self) -> bool:
        """
        Wait until the loading circle in the targeted site disappears.
        If the frontend locks up while loading, this function will attempt to resolve this
        with a page refresh (and the return value indicates if a refresh occurred).
        """

        wait_timeout_seconds = 30
        logging.debug("Waiting until MPC loading circle disappears...")
        try:
            wait_elem = self.driver.find_element(by=By.ID, value="sysdiv_wait")
            # Wait for the element to become invisible
            while True:
                try:
                    WebDriverWait(self.driver, wait_timeout_seconds, poll_frequency=0.1).until(
                        invisibility_of_element(wait_elem)
                    )
                except sl_exc.TimeoutException:
                    logging.info(
                        f"Waited for longer than {wait_timeout_seconds}s for the {self.target_site.name} page "
                        f"to respond - attempting to resolve with a page refresh..."
                    )
                    self.driver.refresh()
                    return True
                logging.debug("The loading circle has disappeared!")
                break
        except (sl_exc.NoSuchElementException, sl_exc.NoSuchFrameException, sl_exc.WebDriverException) as e:
            logging.debug("Attempted to locate the loading circle but encountered an exception:")
            logging.debug(e)
        return False

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
                logging.debug(f"Waited {t} seconds for {function} to be defined - just going to power on.")
                return
            try:
                assert self.execute_javascript(f"typeof {function} == undefined", return_=True) is True
                return
            except (AssertionError, sl_exc.JavascriptException):
                logging.debug(f"Waiting for {function} to be defined...")
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

        logging.debug("Configuring the site with different images for each card in this face.")
        self.wait_until_javascript_object_is_defined("setMode")
        self.wait_until_javascript_object_is_defined("oRenderFeature")  # looks weird but it goes
        self.execute_javascript("setMode('ImageText', 0);")

    @alert_handler
    @exception_retry_skip_handler
    def same_images(self) -> None:
        """
        Sets each card in the current face to use the same image.
        """

        logging.debug("Configuring the site with the same image for each card in this face.")
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

        logging.debug(f"Attempting to upload {image.name}...")
        # an image definitely shouldn't be uploading here, but doesn't hurt to make sure
        while self.is_image_currently_uploading():
            logging.debug("Waiting until the currently uploading image is done...")
            time.sleep(0.5)

        # send the image contents to mpc
        logging.debug("Sending image contents to the targeted site...")
        self.driver.find_element(by=By.ID, value="uploadId").send_keys(image.file_path)
        time.sleep(1)

        # wait for the image to finish uploading
        logging.debug("Waiting until the image has finished uploading...")
        while self.is_image_currently_uploading():
            time.sleep(0.5)
        logging.debug(f"Finished uploading {image.name}!")

    @exception_retry_skip_handler
    def upload_image(self, image: CardImage, max_tries: int = 3) -> Optional[str]:
        """
        Uploads the given CardImage with `max_tries` attempts. Returns the image's PID in the targeted site.
        """

        if image.file_path is not None and image.file_exists():
            if image.file_path in self.file_path_to_pid_map.keys():
                pid = self.file_path_to_pid_map[image.file_path]
                logging.debug(f"Image {image.name} has already been uploaded - reusing its PID ({pid})")
                return pid

            self.set_state(self.state, f'Uploading "{image.name}"')
            get_number_of_uploaded_images = self.get_number_of_uploaded_images()

            tries = 0
            while True:
                logging.debug(f"Commencing attempt {tries+1} of uploading {image.name}...")
                self.attempt_to_upload_image(image)
                if self.get_number_of_uploaded_images() > get_number_of_uploaded_images:
                    # a new image has been uploaded - assume the last image in the editor is the one we just uploaded
                    pid = self.get_all_uploaded_image_pids()[-1]
                    self.file_path_to_pid_map[image.file_path] = pid
                    return pid
                tries += 1
                if tries >= max_tries:
                    logging.warning(
                        f"Attempted to upload image {bold(image.name)} {max_tries} times, "
                        f"but no attempt succeeded! Skipping this image."
                    )
                    return None
        else:
            logging.warning(f"Image {bold(image.name)} at path {bold(image.file_path or 'None')} does not exist!")
            return None

    @exception_retry_skip_handler
    def insert_image(self, pid: Optional[str], image: CardImage, slots: list[int], max_tries: int = 3) -> None:
        """
        Inserts the image identified by `pid` into `slots`.
        """

        logging.debug("Waiting until we can insert images...")
        self.wait_until_javascript_object_is_defined("PageLayout.prototype.applyDragPhoto")

        if pid:
            logging.debug(f'Inserting "{image.name}" into slots {slots}...')
            for i, slot in enumerate(slots, start=1):
                logging.debug(f"Inserting into slot {slot}...")
                self.set_state(
                    state=self.state, action=f'Inserting "{image.name}" into slot {slot+1} ({i}/{len(slots)})'
                )
                # Insert the card into each slot and wait for the page to load before continuing
                tries = 0
                page_refreshed_while_inserting_image = True
                while page_refreshed_while_inserting_image:
                    self.execute_javascript(
                        f'PageLayout.prototype.applyDragPhoto({self.get_element_for_slot_js(slot)}, 0, "{pid}")'
                    )

                    page_refreshed_while_inserting_image = self.wait()
                    tries += 1
                    if tries >= max_tries:
                        logging.warning(
                            f"Attempted to insert image {bold(image.name)} {max_tries} times, "
                            f"but no attempt succeeded! Skipping this image."
                        )
                        break
            logging.debug(f"All done inserting {image.name} into slots {slots}!")
            self.set_state(self.state)
        else:
            logging.debug(f"No PID for {image.name} - skipping this image")

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

        valid_slots = sorted(
            [
                slot
                for slot in image.slots
                if self.execute_javascript(self.get_element_for_slot_js(slot=slot), return_=True)
            ]
        )
        slots_filled = [self.is_slot_filled(slot) for slot in valid_slots]
        logging.debug(f"Image {image.name} has valid slots {valid_slots}")
        if all(slots_filled):
            logging.debug("All valid slots are filled - no work to do here!")
            return False
        elif not any(slots_filled):
            logging.debug("No valid slots are are filled.")
            pid = self.upload_image(image)
            self.insert_image(pid, image, slots=valid_slots)
        else:
            logging.debug("Some valid slots are filled - filling all slots with the image of the first filled one.")
            idx = next(index for index, value in enumerate(slots_filled) if value is True)
            pid = self.execute_javascript(
                f'{self.get_element_for_slot_js(valid_slots[idx])}.getAttribute("pid")', return_=True
            )
            unfilled_slot_numbers = [slot for i, slot in enumerate(valid_slots) if slots_filled[i] is False]
            self.insert_image(pid, image, slots=unfilled_slot_numbers)
        return True

    @exception_retry_skip_handler
    def upload_and_insert_images(
        self, order: CardOrder, images: CardImageCollection, auto_save_threshold: Optional[int]
    ) -> None:
        image_count = len(images.cards_by_id)
        logging.debug(f"Inserting {image_count} images into face {images.face}...")
        for i in range(image_count):
            image: CardImage = images.queue.get()
            if image.downloaded:
                project_mutated = self.upload_and_insert_image(image)
                if (
                    auto_save_threshold is not None
                    and project_mutated
                    and ((i % auto_save_threshold) == (auto_save_threshold - 1) or i == (image_count - 1))
                ):
                    self.save_project_to_user_account(order=order)
            self.upload_bar.update()
            self.upload_bar.refresh()
        logging.debug(f"Finished inserting {image_count} images into face {images.face}!")

    # endregion

    # region authentication

    @exception_retry_skip_handler
    def is_user_authenticated(self) -> bool:
        return len(self.driver.find_elements(By.XPATH, f'//a[@href="{self.target_site.value.logout_url}"]')) == 1

    @exception_retry_skip_handler
    def authenticate(self) -> None:
        if self.is_user_authenticated():
            return
        logging.debug("Attempting to authenticate the user with the targeted site...")
        action = self.action
        self.driver.get(f"{self.target_site.value.login_url}")
        self.set_state(States.defining_order, "Awaiting user sign-in")
        logging.info(
            textwrap.dedent(
                f"""
                The specified inputs require you to sign into your {bold(self.target_site.name)} account.
                The tool will automatically resume once you've signed in.
                """
            )
        )
        while not self.is_user_authenticated():
            time.sleep(1)
        logging.info("Successfully signed in!")
        self.set_state(States.defining_order, action)
        self.driver.get(f"{self.target_site.value.starting_url}")
        logging.debug("Finished authenticating the user with the targeted site!")

    # endregion

    # region project management

    @exception_retry_skip_handler
    def set_bracket(self, order: CardOrder, dropdown_id: str) -> None:
        """
        Configure the project to fit into the smallest

        :raises: If the project size does not fit into any bracket
        """

        logging.debug(f"Configuring the bracket for the order containing {order.details.quantity} cards...")
        qty_dropdown = Select(self.driver.find_element(by=By.ID, value=dropdown_id))
        bracket_options = sorted(
            [
                option_value
                for option in qty_dropdown.options
                if (option_value := int(option.get_attribute("value"))) >= order.details.quantity
            ]
        )
        assert bracket_options, (
            f"Your project contains {bold(order.details.quantity)} cards - this does not fit into any bracket "
            f"that {bold(self.target_site.name)} offers! The brackets are: "
            f"{', '.join([bold(option) for option in bracket_options])}"
        )
        bracket = bracket_options[0]
        logging.debug(f"The smallest bracket for {order.details.quantity} cards is {bracket}.")
        logging.info(f"This project fits into the bracket of up to {bold(bracket)} cards.")
        qty_dropdown.select_by_value(str(bracket))
        logging.debug("Finished configuring the order's bracket!")

    @exception_retry_skip_handler
    def define_project(self, order: CardOrder) -> None:
        logging.debug("Defining the project...")
        self.assert_state(States.defining_order)

        # Select card stock
        logging.debug(f"Selecting cardstock {order.details.stock}...")
        stock_to_select = self.target_site.value.cardstock_site_name_mapping.get(Cardstocks(order.details.stock))
        assert (
            stock_to_select
        ), f"Cardstock {bold(order.details.stock)} is not supported by {bold(self.target_site.name)}!"
        stock_dropdown = Select(
            self.driver.find_element(by=By.ID, value=self.target_site.value.cardstock_dropdown_element_id)
        )
        stock_dropdown.select_by_visible_text(stock_to_select)

        # Select number of cards
        logging.debug("Selecting the number of cards...")
        self.set_bracket(order=order, dropdown_id=self.target_site.value.quantity_dropdown_element_id)

        # Switch the finish to foil if the user ordered foil cards
        if order.details.foil:
            if self.target_site.value.supports_foil:
                logging.debug("Selecting foil finish...")
                foil_dropdown = Select(
                    self.driver.find_element(by=By.ID, value=self.target_site.value.print_type_dropdown_element_id)
                )
                foil_dropdown.select_by_value(self.target_site.value.foil_dropdown_element_value)
            else:
                logging.warning(
                    textwrap.dedent(
                        f"""
                        {bold('WARNING')}: Your project is configured to be printed in foil,
                        but {bold(self.target_site.name)} does not support foil printing.
                        {bold('Your project will be auto-filled as non-foil.')}
                        """
                    )
                )

        logging.debug("Finished defining the project!")
        self.set_state(States.paging_to_fronts)

    @alert_handler
    @exception_retry_skip_handler
    def redefine_project(self, order: CardOrder) -> None:
        """
        Called when continuing to edit an existing project in the targeted site.
        Ensures that the project's size and bracket align with the order's size and bracket.
        """

        logging.debug("Redefining the project...")
        self.set_state(States.defining_order, "Awaiting user input")
        self.driver.get(f"{self.target_site.value.saved_projects_url}")
        input(
            textwrap.dedent(
                f"""
                Continuing to edit an existing order. Please enter the project editor for your selected project,
                wait for the page to load {bold('fully')}, then return to the console window and press {bold('Enter')}.
                """
            )
        )
        while (ssid := self.get_ssid()) is None:
            input(
                textwrap.dedent(
                    "The SSID of the project cannot be determined from the current URL. "
                    "Are you sure you're in the project editor?"
                    "Please enter the editor for your selected project, "
                    f"then return to the console window and press {bold('Enter')}."
                )
            )
        logging.info("Successfully entered the editor for an existing project!")
        self.set_state(States.defining_order, "Configuring order")

        # navigate to insert fronts page
        logging.debug("Navigating to insert fronts page...")
        self.execute_javascript(f"oTrackerBar.setFlow('{self.target_site.value.insert_fronts_url}?ssid={ssid}');")
        self.wait()

        logging.debug("Executing renderDesignCount()...")
        self.wait_until_javascript_object_is_defined("PageLayout.prototype.renderDesignCount")
        self.execute_javascript("PageLayout.prototype.renderDesignCount()")
        with self.switch_to_frame("sysifm_loginFrame"):
            logging.debug("Executing displayTotalCount()...")
            self.wait_until_javascript_object_is_defined("displayTotalCount")
            self.execute_javascript("displayTotalCount()")  # display the dropdown for "up to N cards"
            self.set_bracket(order=order, dropdown_id="dro_total_count")
            logging.debug(f"Changing the project size to {order.details.quantity}...")
            qty = self.driver.find_element(by=By.ID, value="txt_card_number")
            qty.clear()
            qty.send_keys(str(order.details.quantity))
            self.different_images()
        self.wait()
        self.set_state(States.inserting_fronts)
        logging.debug("Finished redefining the project!")

    @exception_retry_skip_handler
    def save_project_to_user_account(self, order: CardOrder) -> None:
        logging.debug("Saving the project to the user's account...")
        self.set_state(self.state, f"Saving project to {self.target_site.name} account")
        project_name_element = self.driver.find_element(by=By.ID, value="txt_temporaryname")
        project_name = self.get_project_name(order_name=order.name)
        if project_name_element.text != project_name:
            project_name_element.clear()
            project_name_element.send_keys(project_name)
        self.wait_until_javascript_object_is_defined("oDesign.setTemporarySave")
        self.execute_javascript("oDesign.setTemporarySave();")

        wait_timeout_seconds = 30
        try:
            WebDriverWait(self.driver, wait_timeout_seconds).until(
                text_to_be_present_in_element(
                    (By.ID, "div_temporarysavestatus"), self.target_site.value.saved_successfully_text
                )
            )
        except sl_exc.TimeoutException:
            logging.info(
                f"Waited for longer than {wait_timeout_seconds}s for the {self.target_site.name} page to respond - "
                "attempting to resolve with a page refresh..."
            )
            self.driver.refresh()
        logging.debug("Finished saving the project to the user's account!")

    # endregion

    # region insert fronts

    @exception_retry_skip_handler
    def page_to_fronts(self, order: CardOrder) -> None:
        logging.debug("Paging to fronts...")
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
            qty.send_keys(str(order.details.quantity))
            self.different_images()

        self.set_state(States.inserting_fronts)
        logging.debug("Finished paging to fronts!")

    @exception_retry_skip_handler
    def insert_fronts(self, order: CardOrder, auto_save_threshold: Optional[int]) -> None:
        self.assert_state(States.inserting_fronts)
        self.upload_and_insert_images(order=order, images=order.fronts, auto_save_threshold=auto_save_threshold)
        self.set_state(States.paging_to_backs)

    # endregion

    # region insert backs

    @exception_retry_skip_handler
    def page_to_backs(self, order: CardOrder, skip_setup: bool) -> None:
        logging.debug("Paging to backs...")
        self.assert_state(States.paging_to_backs)

        # reset this between fronts and backs
        self.file_path_to_pid_map = {}

        self.next_step()
        self.wait()
        try:
            close_btn = self.driver.find_element(by=By.ID, value="closeBtn")
            if close_btn.is_displayed():  # type: ignore  # TODO: because of missing types in selenium i guess?
                # this may not be clickable after processing one card order
                close_btn.click()
        except NoSuchElementException:
            pass
        self.next_step()

        if skip_setup:
            logging.debug(
                "The order is configured with skip_setup - attempting to bring up same/different images dialogue"
            )
            # bring up the dialogue for selecting same or different images
            self.wait()
            self.wait_until_javascript_object_is_defined("PageLayout.prototype.renderDesignCount")
            try:
                self.execute_javascript("PageLayout.prototype.renderDesignCount()")
            except sl_exc.JavascriptException:  # the dialogue has already been brought up if the above line failed
                pass
        with self.switch_to_frame("sysifm_loginFrame"):
            try:
                if len(order.backs.cards_by_id) == 1:
                    # Same cardback for every card
                    self.same_images()
                else:
                    # Different cardbacks
                    self.different_images()
            except NoSuchWindowException:  # TODO: investigate exactly why this happens under --skipsetup. too tired atm
                pass
        self.set_state(States.inserting_backs)
        logging.debug("Finished paging to backs!")

    def insert_backs(self, order: CardOrder, auto_save_threshold: Optional[int]) -> None:
        self.assert_state(States.inserting_backs)
        self.upload_and_insert_images(order=order, images=order.backs, auto_save_threshold=auto_save_threshold)

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

    def execute_order(
        self,
        order: CardOrder,
        skip_setup: bool,
        auto_save_threshold: Optional[int],
        post_processing_config: Optional[ImagePostProcessingConfig],
    ) -> None:
        t = time.time()
        self.configure_bars_for_order(order=order)
        with ThreadPoolExecutor(max_workers=THREADS) as pool:
            order.fronts.download_images(
                pool=pool, download_bar=self.download_bar, post_processing_config=post_processing_config
            )
            order.backs.download_images(
                pool=pool, download_bar=self.download_bar, post_processing_config=post_processing_config
            )
            if any([skip_setup is True, auto_save_threshold is not None]):
                self.authenticate()

            self.initialise_order(order=order)
            if skip_setup:
                self.redefine_project(order=order)
            else:
                logging.info("Configuring a new project.")
                self.define_project(order=order)
                self.page_to_fronts(order=order)
            self.insert_fronts(order=order, auto_save_threshold=auto_save_threshold)
            self.page_to_backs(order=order, skip_setup=skip_setup)
            self.insert_backs(order=order, auto_save_threshold=auto_save_threshold)
            self.page_to_review()
        log_hours_minutes_seconds_elapsed(t)
        logging.info(
            textwrap.dedent(
                f"""
                Please review your project and ensure everything has been uploaded correctly before finalising with
                {self.target_site.name}. If any images failed to download, links to download them will have been printed
                above. If you need to make any changes to your order, you can do so by adding it to your Saved Projects
                and editing in your normal browser.
                """
            )
        )

    def execute_orders(
        self,
        orders: list[CardOrder],
        auto_save_threshold: Optional[int],
        post_processing_config: Optional[ImagePostProcessingConfig],
    ) -> None:
        logging.info(f"{bold(len(orders))} project/s are scheduled to be auto-filled. They are:")
        for i, order in enumerate(orders, start=1):
            logging.info(f"{i}. {bold(order.name or 'Unnamed Project')}")
            logging.info("  " + order.get_overview())

        self.order_progress_bar.total = len(orders)
        self.order_progress_bar.refresh()
        for i, order in enumerate(orders, start=1):
            logging.info(f"Auto-filling project {bold(i)} of {bold(len(orders))}.")
            skip_setup = inquirer.confirm(
                message=(
                    "Do you want the tool to continue editing an existing project? (Press Enter if you're not sure.)"
                ),
                default=False,
            ).execute()
            self.execute_order(
                order=order,
                skip_setup=skip_setup,
                auto_save_threshold=auto_save_threshold,
                post_processing_config=post_processing_config,
            )
            self.order_progress_bar.update()
            self.order_progress_bar.refresh()
            if i < len(orders):
                if auto_save_threshold is not None:
                    logging.info("Please add this project to your cart before continuing.")
                input(f"Press {bold('Enter')} to continue with auto-filling the next project.\n")

    # endregion
