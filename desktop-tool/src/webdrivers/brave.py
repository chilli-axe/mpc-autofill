from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager, ChromeType
from webdriver_manager.core.utils import OSType, os_name


def get_brave_driver(headless: bool = False) -> Chrome:
    options = Options()
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.add_argument("--headless")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    options.add_experimental_option("detach", True)

    # the binary location for brave must be manually specified
    # the below code block is borrowed from webdriver-manager tests:
    # https://github.com/SergeyPirogov/webdriver_manager/blob/master/tests/test_brave_driver.py
    binary_location = {
        OSType.LINUX: "/usr/bin/brave-browser",
        OSType.MAC: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        OSType.WIN: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    }[os_name()]
    options.binary_location = binary_location

    driver = Chrome(service=Service(ChromeDriverManager(chrome_type=ChromeType.BRAVE).install()), options=options)  # type: ignore
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver
