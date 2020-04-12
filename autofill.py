from selenium.common.exceptions import NoAlertPresentException
from selenium import webdriver
from selenium.webdriver import ActionChains
from selenium.webdriver.support.ui import Select
import time
import os
import xml.etree.ElementTree as ET
from google_drive_downloader import GoogleDriveDownloader as gdd


def fill_cards():
    with webdriver.Chrome() as driver:
        # Read given xml file
        tree = ET.parse("cards.xml")
        root = tree.getroot()

        # Set implicit wait for driver
        driver.implicitly_wait(5)

        # Load Custom Game Cards (63mm x 88mm) page
        driver.get("https://www.makeplayingcards.com/design/custom-blank-card.html")

        # Select card stock
        stock_dropdown = Select(driver.find_element_by_id("dro_paper_type"))
        stock_dropdown.select_by_visible_text(root[0][2].text)

        # Select number of cards
        qty_dropdown = Select(driver.find_element_by_id("dro_choosesize"))
        qty_dropdown.select_by_value(root[0][1].text)

        # Accept current settings and move to next step
        driver.execute_script("javascript:doPersonalize('https://www.makeplayingcards.com/products/pro_item_process_flow.aspx')")

        # Key in the desired number of cards, then move to the next step
        driver.switch_to.frame("sysifm_loginFrame")
        qtyField = driver.find_element_by_id("txt_card_number")
        qtyField.clear()
        qtyField.send_keys(root[0][0].text)

        # Select "different images" for front
        driver.execute_script("javascript:setMode('ImageText', 0);")
        driver.switch_to.default_content()

        # TODO: handle unexpected alert open: {Alert text : Uploading, please wait...}

        # Insert card fronts
        for card in root[1]:
            upload_and_insert_card(driver, card[0].text, card[1].text.strip('][').replace(" ", "").split(','))

        # Page through to backs
        driver.execute_script("javascript:oDesign.setNextStep();")
        try:
            alert = driver.switch_to.alert
            alert.accept()
        except NoAlertPresentException:
            pass
        time.sleep(10)  # TODO: Variable delay
        driver.execute_script("javascript:oDesign.setNextStep();")

        # Select "different images" for backs
        time.sleep(5)  # TODO: Variable delay
        driver.switch_to.frame("sysifm_loginFrame")
        qtyField = driver.find_element_by_id("txt_card_number")

        if len(root[2]) == 0:
            # Same cardback for every card
            driver.execute_script("javascript:setMode('ImageText', 1);")
            driver.switch_to.default_content()

            upload_and_insert_card(driver, root[3].text, [0])
        else:
            # Different cardbacks
            driver.execute_script("javascript:setMode('ImageText', 0);")
            driver.switch_to.default_content()

            # Insert specified cardbacks
            cards_with_backs = []
            total_cards = int(root[0][0].text)
            for card in root[2]:
                # Append current cardbacks
                cards_with_backs.extend(card[1].text.strip('][').replace(" ", "").split(','))
                upload_and_insert_card(driver, card[0].text, card[1].text.strip('][').replace(" ", "").split(','))

            # Cards that need cardbacks are in range(0, total_cards) - card indexes that already have backs
            cards_with_backs = {int(x) for x in cards_with_backs}
            cards_needing_backs = [x for x in range(0, total_cards) if x not in cards_with_backs]
            upload_and_insert_card(driver, root[3][0].text, cards_needing_backs)

        # Page through to finalise project
        driver.execute_script("javascript:oDesign.setNextStep();")
        try:
            alert = driver.switch_to.alert
            alert.accept()
        except NoAlertPresentException:
            pass
        time.sleep(10)  # TODO: Variable delay
        driver.execute_script("javascript:oDesign.setNextStep();")

        input("Press enter to finish up.")


def upload_and_insert_card(driver, drive_id, slots):
    filepath = os.getcwd() + "\cards\{}.png".format(drive_id)
    gdd.download_file_from_google_drive(file_id=drive_id,
                                        dest_path=filepath)

    num_elems = len(driver.find_elements_by_xpath("//*[contains(@id, 'upload_')]"))
    driver.find_element_by_xpath('//*[@id="uploadId"]').send_keys(filepath)  # os.getcwd() + "\cards\image.png"

    while True:
        # Wait until the image has finished uploading
        elem = driver.find_elements_by_xpath("//*[contains(@id, 'upload_')]")
        if len(elem) > num_elems:
            print("New card uploaded")
            break

    # Insert card into the appropriate slots
    time.sleep(1)
    for slot in slots:
        drag_drop_card(driver, elem[-1], slot)


def drag_drop_card(driver, cardElement, slotNumber):
    elem_slot = driver.find_element_by_id("fmItem{}_0".format(slotNumber))
    current_y = elem_slot.location['y']
    driver.execute_script("arguments[0].scrollIntoView();", elem_slot)
    ActionChains(driver).click_and_hold(cardElement).move_to_element(elem_slot).release(elem_slot).perform()
    driver.find_element_by_id("dnImg{}_0_0".format(slotNumber))
    time.sleep(0.6)


if __name__ == "__main__":
    fill_cards()
