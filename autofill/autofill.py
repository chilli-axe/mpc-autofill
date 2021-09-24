import time

from driver import AutofillDriver
from order import CardOrder

if __name__ == "__main__":
    order = CardOrder.from_xml_in_folder()
    driver = AutofillDriver.initialise()
    order.execute(driver)
    time.sleep(30)
    print("")
