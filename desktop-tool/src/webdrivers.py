import sys
from typing import Optional

import undetected_chromedriver as uc
from selenium.webdriver import Edge, Firefox
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chromium.options import ChromiumOptions
from selenium.webdriver.chromium.webdriver import ChromiumDriver
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions


def get_chrome_driver(
    headless: bool = False,
    binary_location: Optional[str] = None,
    remote_debugging_port: Optional[int] = None,
) -> uc.Chrome:
    """
    Create a Chrome driver using undetected-chromedriver to bypass bot detection.
    This automatically handles Cloudflare and similar anti-bot systems.
    """
    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.add_argument("--headless=new")
    if remote_debugging_port is not None:
        options.add_argument(f"--remote-debugging-port={remote_debugging_port}")
    if binary_location is not None:
        options.binary_location = binary_location

    # undetected-chromedriver handles stealth automatically
    # Detect Chrome version from browser or use explicit version if needed
    driver = uc.Chrome(options=options, version_main=144)
    return driver


def get_brave_driver(headless: bool = False, binary_location: Optional[str] = None) -> uc.Chrome:
    """
    Create a Brave driver using undetected-chromedriver.
    """
    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.add_argument("--headless=new")

    # the binary location for brave must be manually specified (otherwise chrome will open instead)
    if binary_location is not None:
        options.binary_location = binary_location
    else:
        default_binary_locations = {
            "linux": "/usr/bin/brave-browser",
            "darwin": "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "win32": "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        }
        if sys.platform not in default_binary_locations.keys():
            raise KeyError(
                f"Cannot determine the default Brave binary location for the operating system {sys.platform}!"
            )
        options.binary_location = default_binary_locations[sys.platform]

    driver = uc.Chrome(options=options)
    return driver


def get_edge_driver(headless: bool = False, binary_location: Optional[str] = None) -> ChromiumDriver:
    """
    Create an Edge driver with stealth options.
    Note: Edge doesn't have an undetected variant, so we use standard stealth measures.
    """
    options: ChromiumOptions = EdgeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    if headless:
        options.add_argument("--headless=new")
    options.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_experimental_option("detach", True)
    if binary_location is not None:
        options.binary_location = binary_location
    driver: ChromiumDriver = Edge(options=options)  # type: ignore
    # Apply CDP stealth for Edge
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """
    })
    return driver


# note: firefox is not currently supported
def get_firefox_driver(headless: bool = False, binary_location: Optional[str] = None) -> Firefox:
    options = FirefoxOptions()
    options.add_argument("--log-level=3")
    if headless:
        options.add_argument("--headless")
    if binary_location is not None:
        options.binary_location = binary_location
    driver = Firefox(options=options)
    return driver
