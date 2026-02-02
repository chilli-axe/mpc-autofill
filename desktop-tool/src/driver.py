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
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.expected_conditions import (
    element_to_be_clickable,
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

    def _try_click_turnstile_checkbox(self) -> bool:
        """
        Attempt to find and click the Cloudflare Turnstile checkbox.
        Returns True if checkbox was found and clicked, False otherwise.
        """
        try:
            # Turnstile is rendered in an iframe - find it by common attributes
            iframe_selectors = [
                "iframe[src*='challenges.cloudflare.com']",
                "iframe[title*='cloudflare']",
                "iframe[title*='Cloudflare']",
                "iframe[id*='cf-']",
            ]

            iframe = None
            for selector in iframe_selectors:
                iframes = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if iframes:
                    iframe = iframes[0]
                    break

            if not iframe:
                return False

            # Switch to iframe context
            self.driver.switch_to.frame(iframe)

            try:
                # Look for the checkbox input or clickable verification element
                checkbox_selectors = [
                    "input[type='checkbox']",
                    ".ctp-checkbox-label",
                    "#challenge-stage",
                    "[data-testid='challenge-input']",
                ]

                for selector in checkbox_selectors:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for element in elements:
                        if element.is_displayed():
                            element.click()
                            logger.debug("Clicked Turnstile checkbox")
                            return True
            finally:
                # Always switch back to main content
                self.driver.switch_to.default_content()

            return False
        except Exception as e:
            logger.debug(f"Error clicking Turnstile checkbox: {e}")
            # Ensure we're back in main content even on error
            try:
                self.driver.switch_to.default_content()
            except Exception:
                pass
            return False

    def _is_cloudflare_challenge_active(self) -> bool:
        """Check if a Cloudflare challenge page is currently displayed."""
        try:
            title = self.driver.title.lower()
            if "just a moment" in title:
                return True
            # Also check for challenge body text
            body_text = self.driver.find_element(By.TAG_NAME, "body").text.lower()
            if "verifying you are human" in body_text or "checking your browser" in body_text:
                return True
            return False
        except Exception:
            return False

    def _is_site_loaded(self) -> bool:
        """Check if the actual site content has loaded (past Cloudflare)."""
        selectors = self.target_site.value.selectors
        try:
            title = self.driver.title.lower()
            if "just a moment" in title:
                return False
            # Check for login button or logged-in indicator
            login_btns = self.driver.find_elements(By.CSS_SELECTOR, selectors.login_button_selector)
            logged_in = self.driver.find_elements(By.CSS_SELECTOR, selectors.logged_in_indicator_selector)
            return bool(login_btns or logged_in)
        except Exception:
            return False

    def wait_for_cloudflare_challenge(self, timeout_seconds: int = 300) -> None:
        """
        Wait for the Cloudflare challenge to be completed by waiting for site content to appear.
        Uses aggressive polling and attempts to auto-click the Turnstile checkbox.
        Waits for either the login button or Publisher Tools link (if already logged in).
        """
        self.set_state(States.defining_order, "Waiting for site to load")
        logger.info("Waiting for DriveThruCards to load...")

        poll_interval = 0.5  # Check every 500ms for responsive detection
        turnstile_click_interval = 3.0  # Try clicking Turnstile every 3 seconds
        last_turnstile_attempt = 0.0
        challenge_detected = False
        start_time = time.time()

        while time.time() - start_time < timeout_seconds:
            # Check if site has loaded successfully
            if self._is_site_loaded():
                logger.info("Site loaded successfully!")
                return

            # Check if we're on a Cloudflare challenge
            if self._is_cloudflare_challenge_active():
                if not challenge_detected:
                    challenge_detected = True
                    logger.info(
                        "Cloudflare challenge detected. Attempting auto-solve...\n"
                        "If this doesn't work, please complete the captcha manually."
                    )

                # Periodically try to click the Turnstile checkbox
                current_time = time.time()
                if current_time - last_turnstile_attempt >= turnstile_click_interval:
                    last_turnstile_attempt = current_time
                    if self._try_click_turnstile_checkbox():
                        logger.debug("Turnstile click attempted, waiting for verification...")

            time.sleep(poll_interval)

        # Timeout reached
        logger.warning(
            f"Timeout after {timeout_seconds}s waiting for site to load. "
            "Attempting to continue anyway."
        )

    def is_dtc_user_authenticated(self) -> bool:
        """Check if the user is logged in to DriveThruCards."""
        selectors = self.target_site.value.selectors
        try:
            # Look for logout button as indicator of being logged in
            # This needs to be specific - only match elements that appear when logged in
            logged_in_elements = self.driver.find_elements(
                By.CSS_SELECTOR, selectors.logged_in_indicator_selector
            )
            # Filter to only visible elements
            visible_elements = [el for el in logged_in_elements if el.is_displayed()]
            if visible_elements:
                logger.debug(f"Found {len(visible_elements)} visible logged-in indicator(s)")
                for el in visible_elements[:3]:
                    logger.debug(f"  Element: tag={el.tag_name}, text='{el.text}', aria-label='{el.get_attribute('aria-label')}'")
            return len(visible_elements) > 0
        except Exception as e:
            logger.debug(f"Error checking auth status: {e}")
            return False

    def click_element_with_retry(self, element: Any) -> bool:
        """
        Attempt to click an element using multiple strategies.
        Returns True if click succeeded, False otherwise.
        """
        # Strategy 1: Scroll into view and use native click
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            element.click()
            return True
        except Exception as e:
            logger.debug(f"Native click failed: {e}")

        # Strategy 2: JavaScript click (bypasses overlays and visibility issues)
        try:
            self.driver.execute_script("arguments[0].click();", element)
            return True
        except Exception as e:
            logger.debug(f"JavaScript click failed: {e}")

        return False

    def click_element_polling(self, by: By, selector: str, timeout: int = 30) -> bool:
        """
        Aggressively poll for an element and click it as soon as it's available.
        No fixed waits - keeps trying until success or timeout.
        """
        start = time.time()
        while time.time() - start < timeout:
            try:
                elements = self.driver.find_elements(by, selector)
                for el in elements:
                    if el.is_displayed() and self.click_element_with_retry(el):
                        return True
            except Exception:
                pass
        return False

    def _click_dtc_login_button(self) -> bool:
        """Click the DriveThruCards login button to open the login modal."""
        selectors = self.target_site.value.selectors
        return self.click_element_polling(By.CSS_SELECTOR, selectors.login_button_selector, timeout=15)

    def _simulate_human_behavior(self) -> None:
        """
        Simulate human-like behavior to help bypass bot detection.
        Adds natural mouse movements and small delays.
        """
        try:
            # Move mouse to a neutral position and perform small movements
            body = self.driver.find_element(By.TAG_NAME, "body")
            actions = ActionChains(self.driver)
            # Small random-ish movements to simulate human behavior
            actions.move_to_element(body)
            actions.move_by_offset(50, 30)
            actions.pause(0.1)
            actions.move_by_offset(-20, 15)
            actions.pause(0.1)
            actions.perform()
            logger.debug("Simulated human mouse movements")
        except Exception as e:
            logger.debug(f"Could not simulate mouse movements: {e}")

    def _trigger_visibility_change_via_minimize(self) -> bool:
        """
        Trigger visibility change by minimizing and restoring the window.
        This causes real browser visibility events without the jarring tab switch.
        """
        try:
            # Store current window size/position to restore later
            original_rect = self.driver.get_window_rect()

            # Minimize triggers visibilitychange (document.hidden = true)
            self.driver.minimize_window()
            time.sleep(0.15)

            # Restore triggers visibilitychange (document.hidden = false) and focus
            self.driver.set_window_rect(
                x=original_rect['x'],
                y=original_rect['y'],
                width=original_rect['width'],
                height=original_rect['height']
            )
            time.sleep(0.1)

            logger.debug("Triggered visibility change via window minimize/restore")
            return True
        except Exception as e:
            logger.debug(f"Window minimize/restore failed: {e}")
            return False

    def _perform_tab_switch_workaround(self) -> bool:
        """
        Fallback workaround: open a new tab, close it, return to original.
        This triggers real browser visibility/focus events that reset bot detection state.
        """
        try:
            original_window = self.driver.current_window_handle
            self.driver.switch_to.new_window('tab')
            self.driver.close()
            self.driver.switch_to.window(original_window)
            logger.debug("Tab switch workaround completed")
            return True
        except Exception as e:
            logger.debug(f"Tab switch workaround failed: {e}")
            return False

    def _perform_login_focus_workaround(self) -> bool:
        """
        Workaround for DriveThruCards bot detection.
        The site shows "Unable to log in" error on automated first attempts.

        The bot detection appears to track whether the page has received natural
        visibility/focus events. By triggering these events, we reset the detection state.

        Tries minimize/restore first (cleanest), falls back to tab switch if needed.
        """
        logger.debug("Performing focus workaround to bypass bot detection...")

        # First, add some human-like behavior
        self._simulate_human_behavior()

        # Try minimize/restore approach first (cleaner than tab switch)
        if self._trigger_visibility_change_via_minimize():
            return True

        # Fallback to tab switch (more reliable but visible to user)
        logger.debug("Minimize/restore failed, falling back to tab switch workaround")
        return self._perform_tab_switch_workaround()

    def authenticate_dtc(self) -> None:
        """
        Handle DriveThruCards login flow.

        Note: DriveThruCards has bot detection that shows "Unable to log in" error.
        Workaround: Click "log in with D20" then hit back before actual login.
        """
        selectors = self.target_site.value.selectors

        if self.is_dtc_user_authenticated():
            logger.info("Already logged in to DriveThruCards.")
            return

        self.set_state(States.defining_order, "Awaiting DriveThruCards login")

        # Perform workaround to bypass bot detection (focus change resets state)
        self._perform_login_focus_workaround()

        logger.info("Please log in to your DriveThruCards account.")

        # Now attempt actual login flow
        if not self._click_dtc_login_button():
            logger.info(
                "Could not find or click login button automatically.\n"
                "Please click the login button manually."
            )

        # Click "Go to Log in" link - poll aggressively
        go_to_login_clicked = self.click_element_polling(
            By.XPATH, "//a[contains(normalize-space(), 'Go to Log in')]", timeout=15
        )
        if not go_to_login_clicked:
            # Fallback to CSS selector
            go_to_login_clicked = self.click_element_polling(
                By.CSS_SELECTOR, selectors.go_to_login_selector, timeout=5
            )

        if go_to_login_clicked:
            logger.info("Navigated to login page.")
        else:
            logger.info(
                "Could not find 'Go to Log in' link automatically.\n"
                "Please navigate to the login page manually if needed."
            )

        logger.info(
            "Please complete the login process in the browser window.\n"
            "The tool will automatically continue once you're logged in."
        )

        # Wait for user to complete login (timeout after 5 minutes)
        timeout_seconds = 300
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            time.sleep(1)
            if self.is_dtc_user_authenticated():
                logger.info("Successfully logged in to DriveThruCards!")
                return

        logger.warning(
            f"Login timeout after {timeout_seconds}s. "
            "Please ensure you're logged in before continuing."
        )

    def navigate_to_dtc_product_setup(self) -> None:
        """
        Navigate through DriveThruCards to the product setup page.
        Steps: Publisher Tools -> Set up a new title
        """
        self.set_state(States.defining_order, "Navigating to Publisher Tools")
        selectors = self.target_site.value.selectors
        
        # Step 1: Click "Publisher Tools" link (use same selector as login detection)
        try:
            publisher_tools_link = WebDriverWait(self.driver, 5).until(
                element_to_be_clickable((By.CSS_SELECTOR, selectors.logged_in_indicator_selector))
            )
            logger.info("Found 'Publisher Tools' link, clicking...")
            if self.click_element_with_retry(publisher_tools_link):
                logger.info("Successfully clicked 'Publisher Tools'.")
            else:
                logger.warning("Could not click 'Publisher Tools' automatically. Please click it manually.")
        except sl_exc.TimeoutException:
            logger.warning("Could not find 'Publisher Tools' link. Trying direct navigation...")
            self.driver.get("https://site.drivethrucards.com/pub_tools.php")
        
        # Step 2: Wait for and click "Set up a new title" link
        self.set_state(States.defining_order, "Navigating to product setup")
        try:
            setup_link = WebDriverWait(self.driver, 10).until(
                element_to_be_clickable((By.XPATH, "//a[contains(@href, 'pub_enter_product.php')]"))
            )
            logger.info("Found 'Set up a new title' link, clicking...")
            if self.click_element_with_retry(setup_link):
                logger.info("Successfully clicked 'Set up a new title'.")
            else:
                logger.warning("Could not click 'Set up a new title' automatically. Please click it manually.")
        except sl_exc.TimeoutException:
            logger.warning("Could not find 'Set up a new title' link. Trying direct navigation...")
            self.driver.get("https://tools.drivethrucards.com/pub_enter_product.php")

    def fill_dtc_product_form(self, order: CardOrder) -> None:
        """
        Fill out the DriveThruCards product setup form (first page).
        """
        import os
        
        self.set_state(States.defining_order, "Filling product form")
        
        # Get the placeholder cover image path (bundled with assets)
        assets_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
        placeholder_cover_path = os.path.join(assets_dir, "placeholder_cover.png")
        
        # Generate title: order name + today's date
        today = dt.date.today().strftime("%Y-%m-%d")
        title = f"{order.name or 'Order'} {today}"
        
        # Fill in the title field
        try:
            title_input = WebDriverWait(self.driver, 10).until(
                presence_of_element_located((By.ID, "products_name"))
            )
            title_input.clear()
            title_input.send_keys(title)
            logger.info(f"Set product title to: {title}")
        except Exception as e:
            logger.warning(f"Could not fill title field: {e}")
        
        # Fill in the special price field with "0"
        try:
            price_input = self.driver.find_element(By.ID, "options_values_total_price")
            price_input.clear()
            price_input.send_keys("0")
            logger.info("Set special price to: 0")
        except Exception as e:
            logger.warning(f"Could not fill price field: {e}")
        
        # Upload the placeholder cover image
        try:
            image_input = self.driver.find_element(By.NAME, "products_image")
            image_input.send_keys(placeholder_cover_path)
            logger.info(f"Uploaded placeholder cover image: {placeholder_cover_path}")
        except Exception as e:
            logger.warning(f"Could not upload cover image: {e}")
        
        # Check the two filter checkboxes
        try:
            checkbox1 = self.driver.find_element(By.ID, "filter_44550")
            if not checkbox1.is_selected():
                self.click_element_with_retry(checkbox1)
            logger.debug("Checked filter_44550")
        except Exception as e:
            logger.warning(f"Could not check filter_44550: {e}")
        
        try:
            checkbox2 = self.driver.find_element(By.ID, "filter_1000138")
            if not checkbox2.is_selected():
                self.click_element_with_retry(checkbox2)
            logger.debug("Checked filter_1000138")
        except Exception as e:
            logger.warning(f"Could not check filter_1000138: {e}")
        
        # Click the first submit button (Save Title Data and Continue to Preview Description)
        self.set_state(States.defining_order, "Submitting product form")
        try:
            submit_button = WebDriverWait(self.driver, 10).until(
                element_to_be_clickable((By.ID, "submit_id"))
            )
            logger.info("Clicking submit button...")
            self.click_element_with_retry(submit_button)
            logger.info("Product form submitted successfully.")
        except Exception as e:
            logger.warning(f"Could not click submit button: {e}")

    def submit_dtc_description_page(self) -> None:
        """
        Click 'Save and Continue' on the description preview page.
        Waits for the button to be available (page loaded from previous step).
        """
        self.set_state(States.defining_order, "Saving description")
        try:
            save_continue_button = WebDriverWait(self.driver, 15).until(
                element_to_be_clickable((By.ID, "clicked_element"))
            )
            logger.info("Clicking 'Save and Continue' button...")
            self.click_element_with_retry(save_continue_button)
            logger.info("Description page submitted.")
        except Exception as e:
            logger.warning(f"Could not click 'Save and Continue': {e}")

    def open_dtc_upload_page(self) -> None:
        """
        Click 'Upload print-ready file' button which opens a new tab,
        then switch to that tab.
        Waits for button to be available (page loaded from previous step).
        """
        self.set_state(States.defining_order, "Opening upload page")
        
        # Store current window handles
        original_windows = set(self.driver.window_handles)
        
        try:
            # Wait for and click the upload button
            upload_button = WebDriverWait(self.driver, 15).until(
                element_to_be_clickable((By.XPATH, "//button[contains(@onclick, 'pub_upload_podcard_files.php')]"))
            )
            logger.info("Clicking 'Upload print-ready file' button...")
            self.click_element_with_retry(upload_button)
            
            # Wait for new window/tab to open (poll until a new window appears)
            WebDriverWait(self.driver, 15).until(
                lambda d: len(d.window_handles) > len(original_windows)
            )
            
            # Find the new window and switch to it
            new_windows = set(self.driver.window_handles) - original_windows
            if new_windows:
                new_window = new_windows.pop()
                self.driver.switch_to.window(new_window)
                logger.info(f"Switched to upload tab: {self.driver.current_url}")
            else:
                logger.warning("No new tab detected after clicking upload button.")
        except Exception as e:
            logger.warning(f"Could not open upload page: {e}")

    def select_card_type_and_upload_pdf(self, pdf_path: str) -> None:
        """
        Select 'Premium Euro Poker Card(s)' from dropdown and upload the PDF.
        Waits for elements to be available instead of using fixed sleeps.
        """
        import os
        
        self.set_state(States.inserting_fronts, "Selecting card type")
        
        # Wait for and select the Euro Poker card option from the dropdown
        try:
            # Wait for dropdown to be present and interactable
            WebDriverWait(self.driver, 15).until(
                presence_of_element_located((By.ID, "card_type_select"))
            )
            # Re-fetch the element to avoid stale reference after page/tab switch
            card_type_dropdown = self.driver.find_element(By.ID, "card_type_select")
            select = Select(card_type_dropdown)
            
            # Find option containing "Euro Poker" (case-insensitive search)
            euro_poker_option_text = None
            for option in select.options:
                if "euro poker" in option.text.lower():
                    euro_poker_option_text = option.text
                    break
            
            if euro_poker_option_text:
                select.select_by_visible_text(euro_poker_option_text)
                logger.info(f"Selected '{euro_poker_option_text}' from dropdown.")
            else:
                logger.warning("Could not find Euro Poker option in dropdown.")
        except Exception as e:
            logger.warning(f"Could not select card type: {e}")
        
        # Convert PDF path to absolute if needed
        if not os.path.isabs(pdf_path):
            pdf_path = os.path.abspath(pdf_path)
        
        # Verify the file exists
        if not os.path.exists(pdf_path):
            logger.error(f"PDF file not found: {pdf_path}")
            return
        
        logger.info(f"PDF file found: {pdf_path} ({os.path.getsize(pdf_path)} bytes)")
        
        # Wait for the dropzone to appear after card type selection
        self.set_state(States.inserting_fronts, "Uploading PDF")
        try:
            # Wait for the dropzone div to be present
            dropzone_div = WebDriverWait(self.driver, 15).until(
                presence_of_element_located((By.ID, "uploadfiles"))
            )
            logger.debug("Dropzone div found.")
            
            # Click the dropzone to initialize Dropzone's hidden input
            # This should create the .dz-hidden-input element
            logger.debug("Clicking dropzone to initialize hidden input...")
            self.driver.execute_script("arguments[0].click();", dropzone_div)
            
            # Brief wait for the file dialog to appear, then send Escape to close it
            time.sleep(0.5)
            ActionChains(self.driver).send_keys(Keys.ESCAPE).perform()
            time.sleep(0.5)
            
            # Find the file input and send the file - do this in a single operation
            # to avoid stale element references
            logger.info(f"Uploading PDF: {pdf_path}")
            
            def find_and_use_file_input() -> bool:
                """Find a usable file input and send the file path to it."""
                # Strategy 1: Dropzone hidden input
                try:
                    fi = self.driver.find_element(By.CSS_SELECTOR, ".dz-hidden-input")
                    logger.debug("Found Dropzone hidden input, sending file...")
                    fi.send_keys(pdf_path)
                    return True
                except (sl_exc.NoSuchElementException, sl_exc.StaleElementReferenceException):
                    pass
                
                # Strategy 2: Any file input that's not the fallback
                try:
                    file_inputs = self.driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
                    logger.debug(f"Found {len(file_inputs)} file input(s) on page.")
                    for fi in file_inputs:
                        try:
                            name = fi.get_attribute("name")
                            if name == "groups_csv":
                                continue
                            logger.debug(f"Trying file input: name={name}")
                            fi.send_keys(pdf_path)
                            return True
                        except sl_exc.StaleElementReferenceException:
                            continue
                except Exception as e:
                    logger.debug(f"Error with file inputs: {e}")
                
                # Strategy 3: Use the fallback input
                try:
                    logger.debug("Using fallback file input...")
                    self.driver.execute_script(
                        "document.getElementById('dropzoneFallback').style.display = 'block';"
                    )
                    fi = self.driver.find_element(By.CSS_SELECTOR, "#dropzoneFallback input[type='file']")
                    fi.send_keys(pdf_path)
                    return True
                except Exception as e:
                    logger.debug(f"Fallback input failed: {e}")
                
                return False
            
            # Try up to 3 times to handle any remaining stale element issues
            file_sent = False
            for attempt in range(3):
                if find_and_use_file_input():
                    file_sent = True
                    break
                logger.debug(f"Attempt {attempt + 1} failed, retrying...")
                time.sleep(0.5)
            
            if not file_sent:
                logger.warning("Could not send file to any input element.")
                return
            
            # Trigger change event on all file inputs (one of them has our file)
            self.driver.execute_script("""
                document.querySelectorAll('input[type="file"]').forEach(function(input) {
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
            """)
            logger.debug("Dispatched change event on file inputs.")
            
            # Wait for the upload button to become enabled (Dropzone enables it when files are queued)
            try:
                WebDriverWait(self.driver, 10).until(
                    lambda d: not d.find_element(By.ID, "dropzoneButton").get_attribute("disabled")
                )
                logger.debug("Upload button is now enabled.")
            except sl_exc.TimeoutException:
                logger.debug("Button didn't become enabled automatically, forcing it.")
            
            # Click the upload button using JavaScript
            upload_clicked = self.driver.execute_script("""
                var btn = document.getElementById('dropzoneButton');
                if (btn) {
                    btn.disabled = false;
                    btn.style.display = 'block';
                    btn.click();
                    return true;
                }
                return false;
            """)
            if upload_clicked:
                logger.info("Clicked 'Begin Card File Upload' button via JavaScript.")
            else:
                logger.warning("Could not find upload button.")
            
            # Also try to trigger Dropzone's processQueue as a backup
            try:
                self.driver.execute_script("""
                    var dz = Dropzone.forElement('#uploadfiles');
                    if (dz && dz.files && dz.files.length > 0) {
                        dz.processQueue();
                    }
                """)
                logger.debug("Triggered Dropzone processQueue.")
            except Exception as e:
                logger.debug(f"Could not trigger processQueue: {e}")
            
            # Wait for upload to complete - look for success message
            try:
                WebDriverWait(self.driver, 120).until(
                    lambda d: "successfully uploaded" in (
                        d.find_element(By.ID, "status_messages").text.lower()
                        if d.find_elements(By.ID, "status_messages") else ""
                    )
                )
                logger.info("PDF upload completed to DriveThruCards.")
            except sl_exc.TimeoutException:
                logger.warning("Could not confirm upload completion. Please verify manually.")
            
            # Click the continue button
            try:
                continue_button = WebDriverWait(self.driver, 10).until(
                    element_to_be_clickable((By.ID, "continue_button"))
                )
                self.driver.execute_script("arguments[0].click();", continue_button)
                logger.info("Clicked 'Click here after uploading your files' button.")
            except sl_exc.TimeoutException:
                logger.warning("Could not find continue button. Please click it manually.")
            
            # Click the "Complete Setup" button on the next page
            try:
                complete_button = WebDriverWait(self.driver, 30).until(
                    element_to_be_clickable((By.ID, "submit_id"))
                )
                self.driver.execute_script("arguments[0].click();", complete_button)
                logger.info("Clicked 'Complete Setup' button.")
            except sl_exc.TimeoutException:
                logger.warning("Could not find 'Complete Setup' button. Please click it manually.")
            
            # Click the "buy now" link on the next page
            try:
                buy_now_link = WebDriverWait(self.driver, 30).until(
                    element_to_be_clickable((By.CSS_SELECTOR, "a[href*='action=buy_now']"))
                )
                self.driver.execute_script("arguments[0].click();", buy_now_link)
                logger.info("Clicked 'buy now' link.")
            except sl_exc.TimeoutException:
                logger.warning("Could not find 'buy now' link. Please click it manually.")
        except Exception as e:
            logger.warning(f"Could not upload PDF: {e}")

    def execute_drive_thru_cards_order(self, order: CardOrder, pdf_path: str) -> None:
        t = time.time()
        selectors = self.target_site.value.selectors
        self.set_state(States.defining_order, "Opening DriveThruCards")
        self.driver.get(self.target_site.value.starting_url)

        # Handle Cloudflare challenge if present
        self.wait_for_cloudflare_challenge()

        # Handle login
        self.authenticate_dtc()

        # Navigate to product setup page
        self.navigate_to_dtc_product_setup()

        # Fill out the product form (first page - title, price, cover image, checkboxes)
        self.fill_dtc_product_form(order=order)

        # Submit the description preview page
        self.submit_dtc_description_page()

        # Open the upload page (new tab)
        self.open_dtc_upload_page()

        # Select card type and upload the PDF
        self.select_card_type_and_upload_pdf(pdf_path=pdf_path)

        # DriveThruCards automation complete - user should finish checkout manually
        log_hours_minutes_seconds_elapsed(t)
        logger.info(
            "DriveThruCards order setup complete!\n"
            "You are now at the checkout page. Please review your order and complete the purchase manually."
        )
        return

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
