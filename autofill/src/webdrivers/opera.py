from selenium.webdriver import Opera
from selenium.webdriver.opera.options import Options
from webdriver_manager.opera import OperaDriverManager


def get_opera_driver(headless: bool = False) -> Opera:
    options = Options()
    options.add_argument("--log-level=3")
    if headless:
        options.add_argument("--headless")
    driver = Opera(executable_path=OperaDriverManager().install(), options=options)
    return driver
