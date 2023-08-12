from typing import Optional

from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.core.os_manager import OperationSystemManager, OSType


def get_chrome_driver(headless: bool = False, binary_location: Optional[str] = None) -> Chrome:
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.headless = True
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    options.add_experimental_option("detach", True)
    if binary_location is not None:
        options.binary_location = binary_location
    else:
        # here, we specifically hardcode the binary location in macOS to work around this issue:
        # https://github.com/seleniumHQ/selenium/issues/12381, which is caused by
        # https://github.com/GoogleChromeLabs/chrome-for-testing/issues/30
        # the issue is marked as resolved in the selenium repository but still occurs for me on selenium==4.11.2
        # perhaps something is broken on the webdriver_manager side here
        if OperationSystemManager.get_os_name() == OSType.MAC:
            options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    driver = Chrome(service=Service(ChromeDriverManager().install()), options=options)  # type: ignore
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver
