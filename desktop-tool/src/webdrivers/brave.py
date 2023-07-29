from typing import Optional

from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager, ChromeType
from webdriver_manager.core.os_manager import OperationSystemManager, OSType


def get_brave_driver(headless: bool = False, binary_location: Optional[str] = None) -> Chrome:
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.headless = True
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    options.add_experimental_option("detach", True)

    # the binary location for brave must be manually specified
    # the below code block is partially borrowed from webdriver-manager tests:
    # https://github.com/SergeyPirogov/webdriver_manager/blob/master/tests/test_brave_driver.py
    if binary_location is not None:
        options.binary_location = binary_location
    else:
        default_binary_location = {
            OSType.LINUX: "/usr/bin/brave-browser",
            OSType.MAC: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            OSType.WIN: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        }[OperationSystemManager.get_os_name()]
        options.binary_location = default_binary_location

    driver = Chrome(service=Service(ChromeDriverManager(chrome_type=ChromeType.BRAVE).install()), options=options)  # type: ignore
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver
