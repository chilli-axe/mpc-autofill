import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from copy import deepcopy
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

from src.logging import logger

if TYPE_CHECKING:
    from selenium.webdriver.chrome.webdriver import WebDriver as Chrome
    from selenium.webdriver.chromium.webdriver import ChromiumDriver
    from selenium.webdriver.firefox.webdriver import WebDriver as Firefox
else:
    Chrome = ChromiumDriver = Firefox = Any


def get_chrome_driver(headless: bool = False, binary_location: Optional[str] = None) -> Chrome:
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.chrome.webdriver import WebDriver as ChromeDriver

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
    driver = ChromeDriver(options=options)
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver


def get_brave_driver(headless: bool = False, binary_location: Optional[str] = None) -> Chrome:
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.chrome.webdriver import WebDriver as ChromeDriver

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

    driver = ChromeDriver(options=options)
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver


def get_edge_driver(headless: bool = False, binary_location: Optional[str] = None) -> ChromiumDriver:
    from selenium.webdriver.chromium.options import ChromiumOptions
    from selenium.webdriver.edge.options import Options as EdgeOptions
    from selenium.webdriver.edge.webdriver import WebDriver as Edge

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
    from selenium.webdriver.firefox.options import Options as FirefoxOptions
    from selenium.webdriver.firefox.webdriver import WebDriver as FirefoxDriver

    options = FirefoxOptions()
    options.add_argument("--log-level=3")
    if headless:
        options.add_argument("--headless")
    if binary_location is not None:
        options.binary_location = binary_location
    driver = FirefoxDriver(options=options)
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


def _detect_chrome_version(binary_location: Optional[str] = None) -> Optional[int]:
    """
    Detect the selected Chromium browser version.
    Returns the major version number (e.g., 144) or None if detection fails.
    """
    try:
        if sys.platform == "darwin":
            result = subprocess.run(
                [binary_location or "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        elif sys.platform == "win32":
            registry_key = (
                r"HKEY_CURRENT_USER\Software\BraveSoftware\Brave-Browser\BLBeacon"
                if binary_location and "brave" in binary_location.lower()
                else r"HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon"
            )
            result = subprocess.run(
                ["reg", "query", registry_key, "/v", "version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        else:
            result = subprocess.run(
                [binary_location or "google-chrome", "--version"],
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


def _prepare_native_mac_driver(major: int) -> str:
    import undetected_chromedriver as uc
    from selenium.webdriver.common.selenium_manager import SeleniumManager

    target = Path(uc.Patcher.data_path) / f"chromedriver-mac-arm64-{major}"
    if target.exists() and uc.Patcher(executable_path=str(target)).is_binary_patched():
        return str(target)

    source = SeleniumManager().binary_paths(["--browser", "chrome", "--driver-version", str(major)])["driver_path"]
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=target.parent, prefix=f"{target.name}-")
    try:
        os.close(fd)
        shutil.copy2(source, tmp)
        patcher = uc.Patcher(executable_path=tmp)
        patcher.patch_exe()
        if not patcher.is_binary_patched():
            raise RuntimeError("The native ChromeDriver binary was not patched")
        subprocess.run(["/usr/bin/codesign", "--force", "--sign", "-", tmp], check=True)
        # macOS caches signatures per vnode, so publish a new inode after patching and signing.
        os.replace(tmp, target)
    finally:
        Path(tmp).unlink(missing_ok=True)
    return str(target)


def get_undetected_chrome_driver(
    headless: bool = False,
    binary_location: Optional[str] = None,
    user_data_dir: Optional[str] = None,
    profile_directory: Optional[str] = None,
) -> Chrome:
    """
    Create a Chrome driver using undetected-chromedriver, for sites (DriveThruCards) whose bot detection
    blocks standard Selenium. Only used when targeting DriveThruCards.
    """
    import undetected_chromedriver as uc

    if binary_location is None:
        binary_location = uc.find_chrome_executable()
        if binary_location is None:
            raise FileNotFoundError(
                "Google Chrome was not found. Install Chrome, choose Brave with --browser brave, "
                "or specify a Chromium executable with --binary-location."
            )

    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    if headless:
        options.add_argument("--headless=new")
    options.binary_location = binary_location
    if profile_directory is not None:
        options.add_argument(f"--profile-directory={profile_directory}")

    # undetected-chromedriver handles stealth automatically.
    # Detect the Chrome version ourselves since auto-detection can fail.
    major = _detect_chrome_version(binary_location)
    if sys.platform == "darwin" and platform.machine() == "arm64":
        try:
            if major is None:
                raise RuntimeError("The Chrome major version could not be detected")
            driver_path = _prepare_native_mac_driver(major)
            # uc mutates options, so keep the original available if native launch fails.
            return uc.Chrome(
                options=deepcopy(options),
                version_main=major,
                user_data_dir=user_data_dir,
                driver_executable_path=driver_path,
            )
        except Exception as exc:
            logger.warning(
                f"Could not prepare the native ChromeDriver: {exc}. "
                "Falling back to undetected-chromedriver's default driver. "
                "If that also fails, install Rosetta as a workaround."
            )
    return uc.Chrome(options=options, version_main=major, user_data_dir=user_data_dir)
