import re
import subprocess
import sys
from typing import Optional

import undetected_chromedriver as uc
from selenium.webdriver import Chrome, Edge, Firefox
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chromium.options import ChromiumOptions
from selenium.webdriver.chromium.webdriver import ChromiumDriver
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions


def get_chrome_driver(headless: bool = False, binary_location: Optional[str] = None) -> Chrome:
    options = ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.add_argument("--headless=new")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    options.add_experimental_option("detach", True)
    if binary_location is not None:
        options.binary_location = binary_location
    driver = Chrome(options=options)
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver


def get_brave_driver(headless: bool = False, binary_location: Optional[str] = None) -> Chrome:
    options = ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.add_argument("--headless=new")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    options.add_experimental_option("detach", True)

    # the binary location for brave must be manually specified (otherwise chrome will open instead)
    options.binary_location = binary_location or get_default_brave_binary_location()

    driver = Chrome(options=options)
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver


def get_edge_driver(headless: bool = False, binary_location: Optional[str] = None) -> ChromiumDriver:
    options: ChromiumOptions = EdgeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.add_argument("--headless=new")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    options.add_experimental_option("detach", True)
    if binary_location is not None:
        options.binary_location = binary_location
    driver: ChromiumDriver = Edge(options=options)  # type: ignore
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
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


def get_default_brave_binary_location() -> str:
    default_binary_locations = {
        "linux": "/usr/bin/brave-browser",
        "darwin": "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "win32": "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    }
    if sys.platform not in default_binary_locations.keys():
        raise KeyError(f"Cannot determine the default Brave binary location for the operating system {sys.platform}!")
    return default_binary_locations[sys.platform]


def _detect_chrome_version() -> Optional[int]:
    """
    Detect the installed Chrome version by querying the browser.
    Returns the major version number (e.g., 144) or None if detection fails.
    """
    try:
        if sys.platform == "darwin":
            result = subprocess.run(
                ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        elif sys.platform == "win32":
            result = subprocess.run(
                ["reg", "query", r"HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon", "/v", "version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        else:
            result = subprocess.run(
                ["google-chrome", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )

        # Extract version number from output (e.g., "Google Chrome 144.0.7559.110")
        match = re.search(r"(\d+)\.\d+\.\d+\.\d+", result.stdout)
        if match:
            return int(match.group(1))
    except Exception:
        pass
    return None


def get_undetected_chrome_driver(
    headless: bool = False,
    binary_location: Optional[str] = None,
    user_data_dir: Optional[str] = None,
    profile_directory: Optional[str] = None,
) -> uc.Chrome:
    """
    Create a Chrome driver using undetected-chromedriver, for sites (DriveThruCards) whose bot detection
    blocks standard Selenium. Only used when targeting DriveThruCards.
    """
    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    if headless:
        options.add_argument("--headless=new")
    if binary_location is not None:
        options.binary_location = binary_location
    if user_data_dir is not None:
        options.add_argument(f"--user-data-dir={user_data_dir}")
    if profile_directory is not None:
        options.add_argument(f"--profile-directory={profile_directory}")

    # undetected-chromedriver handles stealth automatically.
    # Detect the Chrome version ourselves since auto-detection can fail.
    return uc.Chrome(options=options, version_main=_detect_chrome_version())
