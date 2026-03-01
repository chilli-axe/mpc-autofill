import re
import subprocess
import sys
from typing import Optional

import undetected_chromedriver as uc
from selenium.webdriver import Edge, Firefox
from selenium.webdriver.chromium.options import ChromiumOptions
from selenium.webdriver.chromium.webdriver import ChromiumDriver
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions


def _detect_chrome_version() -> Optional[int]:
    """
    Detect the installed Chrome version by querying the browser.
    Returns the major version number (e.g., 144) or None if detection fails.
    """
    try:
        if sys.platform == "darwin":
            # macOS: Use the Chrome binary to get version
            result = subprocess.run(
                ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        elif sys.platform == "win32":
            # Windows: Query registry or use wmic
            result = subprocess.run(
                ["reg", "query", r"HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon", "/v", "version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        else:
            # Linux: Use google-chrome binary
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


def _apply_stealth_scripts(driver: uc.Chrome) -> None:
    """
    Apply additional stealth JavaScript to hide automation traces.
    These patches help bypass bot detection on sites like DriveThruCards.
    """
    stealth_js = """
        // Hide webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Fix chrome object
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };

        // Fix permissions query
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Fix plugins to look more realistic
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                { name: 'Native Client', filename: 'internal-nacl-plugin' }
            ]
        });

        // Fix languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        // Remove automation-related properties from window
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    """
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": stealth_js})


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
    options.add_argument("--disable-blink-features=AutomationControlled")
    if headless:
        options.add_argument("--headless=new")
    if remote_debugging_port is not None:
        options.add_argument(f"--remote-debugging-port={remote_debugging_port}")
    if binary_location is not None:
        options.binary_location = binary_location

    # undetected-chromedriver handles stealth automatically
    # Detect Chrome version since auto-detection can fail
    version_main = _detect_chrome_version()
    driver = uc.Chrome(options=options, version_main=version_main)

    # Apply additional stealth scripts
    _apply_stealth_scripts(driver)

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
