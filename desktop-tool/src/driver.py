import datetime as dt
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
from selenium.common.exceptions import NoAlertPresentException, NoSuchElementException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.expected_conditions import (
    presence_of_element_located,
    invisibility_of_element,
    text_to_be_present_in_element,
    visibility_of_element_located,
)
from selenium.webdriver.support.ui import Select, WebDriverWait

from src.constants import (
    PROJECT_MAX_SIZE,
    THREADS,
    Browsers,
    Cardstocks,
    OrderFulfilmentMethod,
    States,
    TargetSites,
)
from src.exc import InvalidStateException
from src.formatting import bold
from src.logging import logger
from src.order import CardImage, CardImageCollection, CardOrder
from src.processing import ImagePostProcessingConfig
from src.utils import (
    alert_handler,
    exception_retry_skip_handler,
    ignore_javascript_errors,
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

    # region initialisation

    def initialise_driver(self) -> None:
        try:
            driver = self.browser.value(headless=self.headless, binary_location=self.binary_location)  # type: ignore  # TODO
            driver.set_window_size(1200, 900)
            driver.implicitly_wait(5)
            driver.get(self.starting_url)
            WebDriverWait(driver, 10).until(visibility_of_element_located((By.TAG_NAME, "body")))
            logger.info(
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
        logger.info(f"Auto-filling {bold(order.name or 'Unnamed Project')}")
        logger.info("  " + order.get_overview())
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

        logger.debug(f"Switching to frame {frame}...")
        in_frame = True
        try:
            self.driver.switch_to.frame(frame)
            logger.debug(f"Successfully switched to frame {frame}.")
        except (sl_exc.NoSuchFrameException, sl_exc.NoSuchElementException) as e:
            in_frame = False
            logger.debug("Tried to switch to the frame but encountered an exception:")
            logger.warning(e)
        yield
        if in_frame:
            logger.debug(f"Switching out of frame {frame}.")
            self.switch_to_default_content()
        else:
            logger.debug(f"Couldn't switch to {frame} earlier so there's nothing to do here.")

    @alert_handler
    @exception_retry_skip_handler
    def wait(self) -> bool:
        """
        Wait until the loading circle in the targeted site disappears.
        If the frontend locks up while loading, this function will attempt to resolve this
        with a page refresh (and the return value indicates if a refresh occurred).
        """

        wait_timeout_seconds = 30
        logger.debug("Waiting until MPC loading circle disappears...")
        try:
            wait_elem = self.driver.find_element(by=By.ID, value="sysdiv_wait")
            WebDriverWait(self.driver, wait_timeout_seconds, poll_frequency=0.1).until(
                invisibility_of_element(wait_elem)
            )
            logger.debug("The loading circle has disappeared!")
        except sl_exc.TimeoutException:
            logger.info(
                f"Waited for longer than {wait_timeout_seconds}s for the {self.target_site.name} page "
                f"to respond - attempting to resolve with a page refresh..."
            )
            self.driver.refresh()
            return True
        except sl_exc.NoSuchElementException:
            # The system called this function when the loading circle wasn't present
            # No worries, just exit here
            pass
        except (sl_exc.NoSuchFrameException, sl_exc.WebDriverException) as e:
            logger.debug("Attempted to locate the loading circle but encountered an exception:")
            logger.debug(e)
        return False

    def wait_for_selector(self, selector: str, timeout_seconds: int = 30) -> None:
        WebDriverWait(self.driver, timeout_seconds, poll_frequency=0.2).until(
            presence_of_element_located((By.CSS_SELECTOR, selector))
        )

    def set_state(self, state: str, action: Optional[str] = None) -> None:
        self.state = state
        self.action = action
        self.status_bar.update(state=bold(self.state), action=bold(self.action or "N/A"))
        self.status_bar.refresh()

    def assert_state(self, expected_state: States) -> None:
        if self.state != expected_state:
            raise InvalidStateException(expected_state, self.state)

    def raw_execute_javascript(self, js: str, return_: bool = False) -> Any:
        """
        Executes the given JavaScript command in self.driver
        This can occasionally fail - e.g.
        "selenium.common.exceptions.JavaScriptException: Message: javascript error: setMode is not defined"
        """

        return self.driver.execute_script(f"javascript:{'return ' if return_ else ''}{js}")  # type: ignore

    @alert_handler
    @exception_retry_skip_handler
    def execute_javascript(self, js: str, return_: bool = False) -> Any:
        return self.raw_execute_javascript(js=js, return_=return_)

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
            elapsed = time.time() - t
            if elapsed > 10:
                logger.debug(f"Waited {elapsed} seconds for {function} to be defined - just going to power on.")
                return
            try:
                assert self.execute_javascript(f"typeof {function} == 'undefined'", return_=True) is False
                return
            except (AssertionError, sl_exc.JavascriptException):
                logger.debug(f"Waiting for {function} to be defined...")
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
    @ignore_javascript_errors
    def different_images(self) -> None:
        """
        Sets each card in the current face to use different images.
        """

        logger.debug("Configuring the site with different images for each card in this face.")
        self.wait_until_javascript_object_is_defined("setMode")
        self.wait_until_javascript_object_is_defined("oRenderFeature")  # looks weird but it goes
        self.raw_execute_javascript("setMode('ImageText', 0);")

    @alert_handler
    @exception_retry_skip_handler
    @ignore_javascript_errors
    def same_images(self) -> None:
        """
        Sets each card in the current face to use the same image.
        """

        logger.debug("Configuring the site with the same image for each card in this face.")
        self.wait_until_javascript_object_is_defined("setMode")
        self.wait_until_javascript_object_is_defined("oRenderFeature")  # looks weird but it goes
        self.raw_execute_javascript("setMode('ImageText', 1);")

    @alert_handler
    @exception_retry_skip_handler
    @ignore_javascript_errors
    def render_design_count(self) -> None:
        logger.debug("Rendering design count...")
        self.wait_until_javascript_object_is_defined("PageLayout.prototype.renderDesignCount")
        self.raw_execute_javascript("PageLayout.prototype.renderDesignCount()")

    @exception_retry_skip_handler
    def is_image_currently_uploading(self) -> bool:
        self.wait_until_javascript_object_is_defined("oDesignImage")
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

    # region DriveThruCards

    def wait_for_cloudflare_challenge(self, timeout_seconds: int = 300) -> None:
        """
        Wait for the Cloudflare challenge to be completed by waiting for site content to appear.
        Checks multiple indicators that the actual site has loaded.
        """
        self.set_state(States.defining_order, "Waiting for site to load")
        logger.info(
            "Waiting for DriveThruCards to load...\n"
            "If you see a Cloudflare captcha, please complete it."
        )

        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            try:
                # Check page title - Cloudflare shows "Just a moment..." 
                title = self.driver.title.lower()
                if "just a moment" in title or "attention required" in title:
                    time.sleep(1)
                    continue
                
                # Check if we're on the actual DriveThruCards site
                # Look for any of these indicators that the real site has loaded
                page_source = self.driver.page_source
                
                # DriveThruCards specific indicators
                site_indicators = [
                    "drivethrucards",
                    "Log In",  # The login button text
                    "data-cy=\"login\"",  # The login button attribute
                    "OneBookShelf",  # Parent company
                ]
                
                if any(indicator in page_source for indicator in site_indicators):
                    logger.info("Site loaded successfully!")
                    time.sleep(2)  # Give page time to fully render
                    return
                    
            except Exception as e:
                logger.debug(f"Error checking page: {e}")
            time.sleep(1)

        logger.warning(f"Timeout after {timeout_seconds}s waiting for site to load. Attempting to continue anyway.")

    def is_dtc_user_authenticated(self) -> bool:
        """Check if the user is logged in to DriveThruCards."""
        selectors = self.target_site.value.selectors
        try:
            # Look for logout link or account link as indicator of being logged in
            logged_in_elements = self.driver.find_elements(
                By.CSS_SELECTOR, selectors.logged_in_indicator_selector
            )
            return len(logged_in_elements) > 0
        except Exception:
            return False

    def authenticate_dtc(self) -> None:
        """
        Handle DriveThruCards login flow.
        Two-step process: click login button, then click "Go to Log in" link.
        Waits for user to complete authentication.
        """
        selectors = self.target_site.value.selectors

        if self.is_dtc_user_authenticated():
            logger.info("Already logged in to DriveThruCards.")
            return

        self.set_state(States.defining_order, "Awaiting DriveThruCards login")
        logger.info("Please log in to your DriveThruCards account.")

        # Step 1: Try to find and click the login button
        try:
            login_button = WebDriverWait(self.driver, 10).until(
                presence_of_element_located((By.CSS_SELECTOR, selectors.login_button_selector))
            )
            logger.info("Clicking the login button...")
            login_button.click()
            time.sleep(2)  # Wait for modal/dialog to appear
        except Exception as e:
            logger.debug(f"Could not find/click login button: {e}")
            logger.info(
                "Could not find login button automatically.\n"
                "Please click the login button manually."
            )

        # Step 2: Try to find and click the "Go to Log in" link
        try:
            go_to_login_link = WebDriverWait(self.driver, 10).until(
                presence_of_element_located((By.CSS_SELECTOR, selectors.go_to_login_selector))
            )
            logger.info("Clicking 'Go to Log in' link...")
            go_to_login_link.click()
            time.sleep(2)  # Wait for login page to load
        except Exception as e:
            logger.debug(f"Could not find/click 'Go to Log in' link: {e}")
            logger.info(
                "Could not find 'Go to Log in' link automatically.\n"
                "Please navigate to the login page manually."
            )

        logger.info(
            "Please complete the login process in the browser window.\n"
            "The tool will automatically continue once you're logged in."
        )

        # Wait for user to complete login (timeout after 5 minutes)
        timeout_seconds = 300
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            time.sleep(2)
            if self.is_dtc_user_authenticated():
                logger.info("Successfully logged in to DriveThruCards!")
                time.sleep(1)  # Give the page a moment to settle
                return

        logger.warning(
            f"Login timeout after {timeout_seconds}s. "
            "Please ensure you're logged in before continuing."
        )

    def execute_drive_thru_cards_order(self, order: CardOrder, pdf_path: str) -> None:
        t = time.time()
        selectors = self.target_site.value.selectors
        self.set_state(States.defining_order, "Opening DriveThruCards")
        self.driver.get(self.target_site.value.starting_url)

        # Handle Cloudflare challenge if present
        self.wait_for_cloudflare_challenge()

        # Handle login
        self.authenticate_dtc()

        if selectors.quantity_selector:
            try:
                self.wait_for_selector(selectors.quantity_selector)
                quantity_input = self.driver.find_element(By.CSS_SELECTOR, selectors.quantity_selector)
                quantity_input.clear()
                quantity_input.send_keys(str(order.details.quantity))
            except sl_exc.WebDriverException as exc:
                logger.warning(f"Failed to set DriveThruCards quantity automatically: {exc}")

        self.set_state(States.inserting_fronts, "Uploading PDF")
        self.wait_for_selector(selectors.pdf_upload_input_selector)
        upload_inputs = self.driver.find_elements(By.CSS_SELECTOR, selectors.pdf_upload_input_selector)
        if len(upload_inputs) <= selectors.pdf_upload_input_index:
            raise Exception(
                f"DriveThruCards PDF upload input not found at index {selectors.pdf_upload_input_index} "
                f"using selector {selectors.pdf_upload_input_selector}."
            )
        upload_inputs[selectors.pdf_upload_input_index].send_keys(pdf_path)
        logger.info("DriveThruCards PDF uploaded. Please confirm the preview and continue checkout.")

        if selectors.continue_selector:
            try:
                self.wait_for_selector(selectors.continue_selector)
                self.driver.find_element(By.CSS_SELECTOR, selectors.continue_selector).click()
            except sl_exc.WebDriverException:
                logger.warning("DriveThruCards continue button could not be clicked automatically.")

        if selectors.add_to_cart_selector:
            try:
                self.wait_for_selector(selectors.add_to_cart_selector)
                self.driver.find_element(By.CSS_SELECTOR, selectors.add_to_cart_selector).click()
            except sl_exc.WebDriverException:
                logger.warning("DriveThruCards add-to-cart button could not be clicked automatically.")

        log_hours_minutes_seconds_elapsed(t)

    # endregion

    # region uploading

    @exception_retry_skip_handler
    def get_pid_of_image_in_slot(self, slot: int) -> Optional[str]:
        return self.execute_javascript(f"{self.get_element_for_slot_js(slot)}.getAttribute('pid')", return_=True)

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

        logger.debug(f"Attempting to upload {image.name}...")
        # an image definitely shouldn't be uploading here, but doesn't hurt to make sure
        while self.is_image_currently_uploading():
            logger.debug("Waiting until the currently uploading image is done...")
            time.sleep(0.5)

        # send the image contents to mpc
        logger.debug("Sending image contents to the targeted site...")
        self.driver.find_element(by=By.ID, value="uploadId").send_keys(image.file_path)
        time.sleep(1)

        # wait for the image to finish uploading
        logger.debug("Waiting until the image has finished uploading...")
        while self.is_image_currently_uploading():
            time.sleep(0.5)
        logger.debug(f"Finished uploading {image.name}!")

    @exception_retry_skip_handler
    def upload_image(self, image: CardImage, max_tries: int = 3) -> bool:
        """
        Uploads the given CardImage with `max_tries` attempts. Returns whether the image was uploaded.
        """

        if image.file_path is not None and image.file_exists():
            image.generate_pid()
            if image.pid in self.get_all_uploaded_image_pids():
                logger.debug(f"Image {image.name} has already been uploaded")
                return False

            self.set_state(self.state, f'Uploading "{image.name}"')
            get_number_of_uploaded_images = self.get_number_of_uploaded_images()

            tries = 0
            while True:
                logger.debug(f"Commencing attempt {tries+1} of uploading {image.name}...")
                self.attempt_to_upload_image(image)
                if self.get_number_of_uploaded_images() > get_number_of_uploaded_images:
                    return True
                tries += 1
                if tries >= max_tries:
                    logger.warning(
                        f"Attempted to upload image {bold(image.name)} {max_tries} times, "
                        f"but no attempt succeeded! Skipping this image."
                    )
                    return False
        else:
            logger.warning(f"Image {bold(image.name)} at path {bold(image.file_path or 'None')} does not exist!")
            return False

    @exception_retry_skip_handler
    def insert_image(self, image: CardImage, max_tries: int = 3) -> bool:
        """
        Inserts the image identified by `pid` into `slots`.
        Returns whether the project state was mutated by doing this.
        """

        valid_slots = sorted(
            [
                slot
                for slot in image.slots
                if self.execute_javascript(self.get_element_for_slot_js(slot=slot), return_=True)
            ]
        )
        logger.debug(f"Image {image.name} has valid slots {valid_slots}")

        logger.debug("Waiting until we can insert images...")
        self.wait_until_javascript_object_is_defined("PageLayout.prototype.applyDragPhoto")

        state_mutated = False

        if image.pid:
            logger.debug(f'Inserting "{image.name}" into slots {valid_slots}...')
            for i, slot in enumerate(valid_slots, start=1):
                logger.debug(f"Inserting into slot {slot}...")

                pid_of_image_in_slot = self.get_pid_of_image_in_slot(slot=slot)
                if pid_of_image_in_slot == image.pid:
                    # image is already assigned to slot - no work to do.
                    continue

                state_mutated = True
                self.set_state(
                    state=self.state, action=f'Inserting "{image.name}" into slot {slot+1} ({i}/{len(valid_slots)})'
                )
                # Insert the card into each slot and wait for the page to load before continuing
                tries = 0
                page_refreshed_while_inserting_image = True
                while page_refreshed_while_inserting_image:
                    self.execute_javascript(
                        f'PageLayout.prototype.applyDragPhoto({self.get_element_for_slot_js(slot)}, 0, "{image.pid}")'
                    )

                    page_refreshed_while_inserting_image = self.wait()
                    tries += 1
                    if tries >= max_tries:
                        logger.warning(
                            f"Attempted to insert image {bold(image.name)} {max_tries} times, "
                            f"but no attempt succeeded! Skipping this image."
                        )
                        break
            logger.debug(f"All done inserting {image.name} into slots {valid_slots}!")
            self.set_state(self.state)
        else:
            logger.debug(f"No PID for {image.name} - skipping this image")

        return state_mutated

    @exception_retry_skip_handler
    def upload_and_insert_image(self, image: CardImage) -> bool:
        """
        Uploads and inserts `image` into the targeted site.
        Returns whether the project state was mutated.
        """

        self.upload_image(image=image)
        return self.insert_image(image=image)

    @exception_retry_skip_handler
    def upload_and_insert_images(
        self, order: CardOrder, images: CardImageCollection, auto_save_threshold: Optional[int]
    ) -> None:
        image_count = len(images.cards_by_id)
        logger.debug(f"Inserting {image_count} images into face {images.face}...")
        for i in range(image_count):
            drive_id, downloaded = images.queue.get()
            if downloaded:
                project_mutated = self.upload_and_insert_image(images.cards_by_id[drive_id])
                if (
                    auto_save_threshold is not None
                    and project_mutated
                    and ((i % auto_save_threshold) == (auto_save_threshold - 1) or i == (image_count - 1))
                ):
                    self.save_project_to_user_account(order=order)
            self.upload_bar.update()
            self.upload_bar.refresh()
        logger.debug(f"Finished inserting {image_count} images into face {images.face}!")

    # endregion

    # region authentication

    @exception_retry_skip_handler
    def is_user_authenticated(self) -> bool:
        return len(self.driver.find_elements(By.XPATH, f'//a[@href="{self.target_site.value.logout_url}"]')) == 1

    @exception_retry_skip_handler
    def authenticate(self) -> None:
        if self.is_user_authenticated():
            return
        logger.debug("Attempting to authenticate the user with the targeted site...")
        action = self.action
        self.driver.get(f"{self.target_site.value.login_url}")
        self.set_state(States.defining_order, "Awaiting user sign-in")
        logger.info(
            textwrap.dedent(
                f"""
                The specified inputs require you to sign into your {bold(self.target_site.name)} account.
                The tool will automatically resume once you've signed in.
                """
            )
        )
        while not self.is_user_authenticated():
            time.sleep(1)
        logger.info("Successfully signed in!")
        self.set_state(States.defining_order, action)
        self.driver.get(f"{self.target_site.value.starting_url}")
        logger.debug("Finished authenticating the user with the targeted site!")

    # endregion

    # region project management

    @exception_retry_skip_handler
    def set_bracket(self, quantity: int, dropdown_id: str) -> None:
        """
        Configure the project to fit into the smallest

        :raises: If the project size does not fit into any bracket
        """

        logger.debug(f"Configuring the bracket for the order containing {quantity} cards...")
        qty_dropdown = Select(self.driver.find_element(by=By.ID, value=dropdown_id))
        bracket_options = sorted(
            [
                option_value
                for option in qty_dropdown.options
                if (option_value := int(option.get_attribute("value"))) >= quantity
            ]
        )
        assert bracket_options, (
            f"Your project contains {bold(quantity)} cards - this does not fit into any bracket "
            f"that {bold(self.target_site.name)} offers! The brackets are: "
            f"{', '.join([bold(option) for option in bracket_options])}"
        )
        bracket = bracket_options[0]
        logger.debug(f"The smallest bracket for {quantity} cards is {bracket}.")
        logger.info(f"This project fits into the bracket of up to {bold(bracket)} cards.")
        qty_dropdown.select_by_value(str(bracket))
        logger.debug("Finished configuring the order's bracket!")

    @exception_retry_skip_handler
    def define_project(self, order: CardOrder) -> None:
        logger.debug("Defining the project...")
        self.assert_state(States.defining_order)

        # Select card stock
        logger.debug(f"Selecting cardstock {order.details.stock}...")
        stock_to_select = self.target_site.value.cardstock_site_name_mapping.get(Cardstocks(order.details.stock))
        assert (
            stock_to_select
        ), f"Cardstock {bold(order.details.stock)} is not supported by {bold(self.target_site.name)}!"
        stock_dropdown = Select(
            self.driver.find_element(by=By.ID, value=self.target_site.value.cardstock_dropdown_element_id)
        )
        stock_dropdown.select_by_visible_text(stock_to_select)

        # Select number of cards
        logger.debug("Selecting the number of cards...")
        self.set_bracket(
            quantity=order.details.quantity, dropdown_id=self.target_site.value.quantity_dropdown_element_id
        )

        # Switch the finish to foil if the user ordered foil cards
        if order.details.foil:
            if self.target_site.value.supports_foil:
                logger.debug("Selecting foil finish...")
                foil_dropdown = Select(
                    self.driver.find_element(by=By.ID, value=self.target_site.value.print_type_dropdown_element_id)
                )
                foil_dropdown.select_by_value(self.target_site.value.foil_dropdown_element_value)
            else:
                logger.warning(
                    textwrap.dedent(
                        f"""
                        {bold('WARNING')}: Your project is configured to be printed in foil,
                        but {bold(self.target_site.name)} does not support foil printing.
                        {bold('Your project will be auto-filled as non-foil.')}
                        """
                    )
                )

        logger.debug("Finished defining the project!")
        self.set_state(States.paging_to_fronts)

    @alert_handler
    @exception_retry_skip_handler
    def redefine_project(self, order: CardOrder, fulfilment_method: OrderFulfilmentMethod) -> CardOrder:
        """
        Called when continuing to edit an existing project in the targeted site.
        Ensures that the project's size and bracket align with the order's size and bracket.
        """

        new_order = order

        logger.debug("Redefining the project...")
        self.set_state(States.defining_order, "Awaiting user input")
        self.driver.get(f"{self.target_site.value.saved_projects_url}")
        input(
            textwrap.dedent(
                f"""
                Please find your project in the {bold('My saved projects')} table
                and click the {bold('Continue to edit')} button next to it.
                Wait for the page to load {bold('fully')}, then return to the
                console window and press {bold('Enter')}.
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
        logger.info("Successfully entered the editor for an existing project!")
        self.set_state(States.defining_order, "Configuring order")

        # navigate to insert fronts page
        logger.debug("Navigating to insert fronts page...")
        self.execute_javascript(f"oTrackerBar.setFlow('{self.target_site.value.insert_fronts_url}?ssid={ssid}');")
        self.wait()

        self.render_design_count()
        with self.switch_to_frame("sysifm_loginFrame"):
            logger.debug("Executing displayTotalCount()...")
            self.wait_until_javascript_object_is_defined("displayTotalCount")

            # read the current project size and calculate the new projcet size
            # truncate the project if it would exceed the max size
            qty_element = self.driver.find_element(by=By.ID, value="txt_card_number")
            current_project_size = int(qty_element.get_attribute("value"))  # type: ignore
            new_project_size = order.details.quantity
            if fulfilment_method == OrderFulfilmentMethod.append_to_project:
                new_project_size += current_project_size
                if new_project_size > PROJECT_MAX_SIZE:
                    logger.warning(
                        f"{bold('Warning')}: After adding this order to the existing {self.target_site.name} project,"
                        f"your project would consist of {new_project_size} cards, exceeding the maximum"
                        f"allowable size of {PROJECT_MAX_SIZE} cards."
                        f"Any cards which fall outside this max allowable project size will be {bold('ignored')}."
                    )
                    new_project_size = min(new_project_size, PROJECT_MAX_SIZE)

                new_order = order.offset_slots(
                    offset=current_project_size, allowed_to_exceed_project_max_size=True
                ).truncate()

            # do the work of editing the project's bracket and quantity
            logger.debug(f"Changing the project size from {current_project_size} to {new_project_size}...")
            self.execute_javascript("displayTotalCount()")  # display the dropdown for "up to N cards"
            self.set_bracket(quantity=new_project_size, dropdown_id="dro_total_count")
            qty_element.clear()
            qty_element.send_keys(str(new_project_size))
            self.different_images()
        self.wait()
        self.set_state(States.inserting_fronts)
        logger.debug("Finished redefining the project!")
        return new_order

    @exception_retry_skip_handler
    def save_project_to_user_account(self, order: CardOrder) -> None:
        logger.debug("Saving the project to the user's account...")
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
            logger.info(
                f"Waited for longer than {wait_timeout_seconds}s for the {self.target_site.name} page to respond - "
                "attempting to resolve with a page refresh..."
            )
            self.driver.refresh()
        logger.debug("Finished saving the project to the user's account!")

    # endregion

    # region insert fronts

    @exception_retry_skip_handler
    def page_to_fronts(self, order: CardOrder) -> None:
        logger.debug("Paging to fronts...")
        self.assert_state(States.paging_to_fronts)

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
        logger.debug("Finished paging to fronts!")

    @exception_retry_skip_handler
    def insert_fronts(self, order: CardOrder, auto_save_threshold: Optional[int]) -> None:
        self.assert_state(States.inserting_fronts)
        self.upload_and_insert_images(order=order, images=order.fronts, auto_save_threshold=auto_save_threshold)
        self.set_state(States.paging_to_backs)

    # endregion

    # region insert backs

    @exception_retry_skip_handler
    def page_to_backs(self, order: CardOrder) -> None:
        logger.debug("Paging to backs...")
        self.assert_state(States.paging_to_backs)

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
        self.wait()

        try:
            is_same_images = order.details.quantity > 1 and self.raw_execute_javascript(
                js=f"{self.get_element_for_slot_js(1)} === null", return_=True
            )
        except sl_exc.JavascriptException:
            is_same_images = True

        changed_from_single_to_different_images = False
        self.render_design_count()
        with self.switch_to_frame("sysifm_loginFrame"):
            if is_same_images and len(order.backs.cards_by_id) == 1:
                # Same cardback for every card
                self.same_images()
            else:
                # Different cardbacks
                self.different_images()
                if is_same_images:
                    changed_from_single_to_different_images = True

        self.set_state(States.inserting_backs)

        if changed_from_single_to_different_images:
            pid = self.get_pid_of_image_in_slot(slot=0)
            slots: set[int] = set(range(1, order.details.quantity)) - set().union(
                *(card.slots for card in order.backs.cards_by_id.values())
            )
            self.insert_image(image=CardImage(slots=slots, name="Cardback", pid=pid))

        logger.debug("Finished paging to backs!")

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
        fulfilment_method: OrderFulfilmentMethod,
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
            if any(
                [
                    fulfilment_method == OrderFulfilmentMethod.append_to_project,
                    fulfilment_method == OrderFulfilmentMethod.continue_project,
                    auto_save_threshold is not None,
                ]
            ):
                self.authenticate()

            self.initialise_order(order=order)
            if fulfilment_method == OrderFulfilmentMethod.new_project:
                logger.info("Configuring a new project.")
                self.define_project(order=order)
                self.page_to_fronts(order=order)
            else:
                order = self.redefine_project(order=order, fulfilment_method=fulfilment_method)

            self.insert_fronts(order=order, auto_save_threshold=auto_save_threshold)
            self.page_to_backs(order=order)
            self.insert_backs(order=order, auto_save_threshold=auto_save_threshold)
            self.page_to_review()
        log_hours_minutes_seconds_elapsed(t)
        logger.info(
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
        logger.info(f"{bold(len(orders))} project/s are scheduled to be auto-filled. They are:")
        for i, order in enumerate(orders, start=1):
            logger.info(f"{i}. {bold(order.name or 'Unnamed Project')}")
            logger.info("  " + order.get_overview())

        self.order_progress_bar.total = len(orders)
        self.order_progress_bar.refresh()
        for i, order in enumerate(orders, start=1):
            logger.info(f"Auto-filling project {bold(i)} of {bold(len(orders))}.")

            fulfilment_method: OrderFulfilmentMethod = inquirer.select(
                message="How would you like to upload this order?",
                choices=[
                    OrderFulfilmentMethod.new_project,
                    OrderFulfilmentMethod.append_to_project,
                    OrderFulfilmentMethod.continue_project,
                ],
                default=OrderFulfilmentMethod.new_project,
            ).execute()

            self.execute_order(
                order=order,
                fulfilment_method=fulfilment_method,
                auto_save_threshold=auto_save_threshold,
                post_processing_config=post_processing_config,
            )
            self.order_progress_bar.update()
            self.order_progress_bar.refresh()
            if i < len(orders):
                if auto_save_threshold is not None:
                    logger.info("Please add this project to your cart before continuing.")
                input(f"Press {bold('Enter')} to continue with auto-filling the next project.\n")

    # endregion
