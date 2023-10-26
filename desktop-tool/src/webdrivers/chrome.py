from typing import Optional

from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options


def get_chrome_driver(headless: bool = False, binary_location: Optional[str] = None) -> Chrome:
    options = Options()
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
