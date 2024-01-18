from typing import Optional

from selenium.webdriver import Firefox
from selenium.webdriver.firefox.options import Options


# note: firefox is not currently supported
def get_firefox_driver(headless: bool = False, binary_location: Optional[str] = None) -> Firefox:
    options = Options()
    options.add_argument("--log-level=3")
    if headless:
        options.add_argument("--headless")
    if binary_location is not None:
        options.binary_location = binary_location
    driver = Firefox(options=options)
    return driver
