from selenium.webdriver import Firefox
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from webdriver_manager.firefox import GeckoDriverManager


def get_firefox_driver(headless: bool = False) -> Firefox:
    options = Options()
    options.add_argument("--log-level=3")
    if headless:
        options.add_argument("--headless")
    driver = Firefox(service=Service(GeckoDriverManager().install()), options=options)
    return driver
