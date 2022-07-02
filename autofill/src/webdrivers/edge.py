from selenium.webdriver import Edge
from selenium.webdriver.edge.options import Options
from selenium.webdriver.edge.service import Service
from webdriver_manager.microsoft import EdgeChromiumDriverManager


def get_edge_driver(headless: bool = False) -> Edge:
    options = Options()
    options.add_argument("--log-level=3")
    if headless:
        options.add_argument("--headless")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    options.add_experimental_option("detach", True)
    driver = Edge(service=Service(EdgeChromiumDriverManager().install()), options=options)
    driver.set_network_conditions(offline=False, latency=5, throughput=5 * 125000)
    return driver
