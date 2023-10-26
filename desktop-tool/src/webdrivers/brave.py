import sys
from typing import Optional

from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options


def get_brave_driver(headless: bool = False, binary_location: Optional[str] = None) -> Chrome:
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.add_argument("--headless=new")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    options.add_experimental_option("detach", True)

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

    driver = Chrome(options=options)
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver
