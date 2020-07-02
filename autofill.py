# To package up as executable, run this in command prompt: pyinstaller autofill.py --onefile --hidden-import=colorama
import colorama
from selenium.common.exceptions import (
    NoAlertPresentException,
    UnexpectedAlertPresentException,
    NoSuchElementException,
    TimeoutException)
from selenium.webdriver.support.expected_conditions import invisibility_of_element
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium import webdriver
import time
import os
import sys
import xml.etree.ElementTree as ET
import numpy as np
import requests
import glob
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor
from functools import partial

# On macOS, os.getcwd() doesn't work as expected - retrieve the executable's directory another way instead
if getattr(sys, 'frozen', False):
    currdir = os.path.dirname(os.path.realpath(sys.executable))
else:
    currdir = os.getcwd()

"""
TODO:
- Handle the popup "your internet connection is slow so this'll take a while"
- Would be nice to have a way of deselecting text bc sometimes the script selects a bunch of content on the page and
  it's slightly ugly
"""


def fill_cards(bar: tqdm, root):
    chrome_options = Options()
    chrome_options.add_argument('--log-level=3')
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_window_size(1200, 900)
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
    driver.execute_script(
        "javascript:doPersonalize('https://www.makeplayingcards.com/products/pro_item_process_flow.aspx')")

    # Key in the desired number of cards, then move to the next step
    driver.switch_to.frame("sysifm_loginFrame")
    qtyField = driver.find_element_by_id("txt_card_number")
    qtyField.clear()
    qtyField.send_keys(root[0][0].text)

    # Select "different images" for front
    driver.execute_script("javascript:setMode('ImageText', 0);")
    driver.switch_to.default_content()

    # Insert card fronts
    fronts_slot = [x[1].text.strip("][").replace(" ", "").split(",") for x in root[1]]
    autofillBtn = driver.find_element_by_class_name("autoFill")
    for i in range(0, len(root[1])):
        driveID = root[1][i][0].text
        elem = upload_card(driver, driveID)
        # TODO: Is this try/catch block strong enough / not causing issues?
        try:
            if len(fronts_slot[i]) > 1:
                for slot in fronts_slot[i]:
                    # Drag and drop card into each slot
                    drag_drop_card(driver, elem, slot)
            elif len(fronts_slot[i + 1]) > 1:
                # Click autofill button
                autofillBtn.click()
                wait(driver)
        except IndexError:
            # Click autofill button
            autofillBtn.click()
            wait(driver)

        time.sleep(0.3)
        bar.update(1)

    # Page through to backs
    driver.execute_script("javascript:oDesign.setNextStep();")
    try:
        alert = driver.switch_to.alert
        alert.accept()
    except NoAlertPresentException:
        pass

    # Page over to the next step from "add text to fronts"
    wait(driver)
    driver.execute_script("javascript:oDesign.setNextStep();")

    # Select "different images" for backs
    wait(driver)
    driver.switch_to.frame("sysifm_loginFrame")

    if len(root[2]) == 0:
        # Same cardback for every card
        driver.execute_script("javascript:setMode('ImageText', 1);")
        driver.switch_to.default_content()
        autofillBtn = driver.find_element_by_class_name("autoFill")
        upload_card(driver, root[-1].text)
        autofillBtn.click()
        bar.update(1)
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
            bar.update(1)

        # Cards that need cardbacks are in range(0, total_cards) - card indexes that already have backs
        cards_with_backs = {int(x) for x in cards_with_backs}
        cards_needing_backs = [x for x in range(0, total_cards) if x not in cards_with_backs]
        upload_and_insert_card(driver, root[3].text, cards_needing_backs)
        bar.update(1)

    # Page through to finalise project
    driver.execute_script("javascript:oDesign.setNextStep();")
    try:
        alert = driver.switch_to.alert
        alert.accept()
    except NoAlertPresentException:
        pass
    wait(driver)
    time.sleep(1)
    driver.execute_script("javascript:oDesign.setNextStep();")

    # Page over to the next step from "add text to backs"
    wait(driver)
    driver.execute_script("javascript:oDesign.setNextStep();")


def wait(driver):
    # Wait until the loading circle on MPC disappears before exiting from this function
    try:
        wait_elem = driver.find_element_by_id("sysimg_wait")
        while True:
            try:
                WebDriverWait(driver, 100).until(invisibility_of_element(wait_elem))
            except TimeoutException:
                continue
            break
    except NoSuchElementException:
        return


def download_card(bar: tqdm, driveID):
    cards_folder = currdir + "/cards"
    if not os.path.exists(cards_folder):
        os.mkdir(cards_folder)

    # Return early if the file already exists
    # (looks for any file with the drive ID as the filename, regardless of extension)
    if glob.glob(cards_folder + "/{}.*".format(driveID)):
        # Card has already been downloaded - increment progress bar and return
        time.sleep(0.1)
        bar.update(1)
        time.sleep(0.1)
        return

    # Query google app to retrieve the card image with the specified drive ID
    # Credit to https://tanaikech.github.io/2017/03/20/download-files-without-authorization-from-google-drive/
    r = requests.post(
        "https://script.google.com/macros/s/AKfycbyIkEI44WXjaeKUKZGe0gb-YicCARr79l6zfJBFWh8dxVnsdP0/exec",
        data={"id": driveID}
    )

    # Define the card's filename and filepath
    filename = driveID + r.json()["name"][-4:]  # include extension from file name
    filepath = cards_folder + "/" + filename

    # Download the image
    f = open(filepath, "bw")
    f.write(np.array(r.json()["result"], dtype=np.uint8))
    f.close()

    # Increment progress bar
    bar.update(1)


def upload_card(driver, driveID):
    cards_folder = currdir + "/cards"
    # Wait until any file with the drive ID as the filename, regardless of extension, is found
    while not glob.glob(cards_folder + "/{}.*".format(driveID)):
        time.sleep(1)
    # The filepath for this card is the first file found with the drive ID as filename,
    # regardless of extension
    filepath = glob.glob(cards_folder + "/{}.*".format(driveID))[0]

    if os.path.isfile(filepath):
        num_elems = len(driver.find_elements_by_xpath("//*[contains(@id, 'upload_')]"))
        driver.find_element_by_xpath('//*[@id="uploadId"]').send_keys(filepath)
        while True:
            try:
                # Wait until the image has finished uploading
                elem = driver.find_elements_by_xpath("//*[contains(@id, 'upload_')]")
                if len(elem) > num_elems:
                    time.sleep(1)
                    return elem[-1]
            except UnexpectedAlertPresentException:
                try:
                    alert = driver.switch_to.alert
                    alert.accept()
                except NoAlertPresentException:
                    pass
    else:
        return ValueError("Yo something broke")


def upload_and_insert_card(driver, driveID, slots):
    # Upload card
    elem = upload_card(driver, driveID)
    if type(elem) != list:
        elem = [elem]

    # Insert card into the appropriate slots
    time.sleep(1)
    for slot in slots:
        drag_drop_card(driver, elem[-1], slot)


def drag_drop_card(driver, cardElement, slotNumber):
    elem_slot = driver.find_element_by_id("fmItem{}_0".format(slotNumber))
    elem_visible = driver.find_element_by_id("bnbox{}_0_0".format(slotNumber))
    current_y = elem_slot.location['y']
    driver.execute_script("arguments[0].scrollIntoView();", elem_slot)
    ActionChains(driver).click_and_hold(cardElement).move_to_element(elem_slot).release(elem_slot).perform()
    wait(driver)
    while driver.find_element_by_id("dnImg{}_0_0".format(slotNumber)) is None:
        time.sleep(0.3)
        ActionChains(driver).click_and_hold(cardElement).move_to_element(elem_slot).release(elem_slot).perform()
        wait(driver)


if __name__ == "__main__":
    print("Welcome to MPC Autofill!")
    # Parse XML doc
    tree = ET.parse(currdir + "/cards.xml")
    root = tree.getroot()

    # Retrieve google drive IDs
    driveIDs = [x[0].text for x in root[1]]
    driveIDs.extend([x[0].text for x in root[2]])
    driveIDs.extend([root[-1].text])
    print("Successfully read XML file. Starting card downloader and webdriver processes.")

    # Create ThreadPoolExecutor to download card images with, and progress bars for downloading and uploading
    with ThreadPoolExecutor(max_workers=5) as pool, \
        tqdm(position=0, total=len(driveIDs), desc="DL", leave=True) as dl_progress, \
        tqdm(position=1, total=len(driveIDs), desc="UL", leave=False) as ul_progress:
        # Download each card image in parallel, with the same progress bar input each time
        pool.map(partial(download_card, dl_progress), driveIDs)
        # Launch the main webdriver automation function
        fill_cards(ul_progress, root)
        dl_progress.close()
        ul_progress.close()
        print("")
    input("Autofill complete!\n"
          "Cards are occasionally not uploaded properly with this tool.\n"
          "Please review the order and ensure everything is as you desired before closing \n"
          "closing MPC Autofill. If you need to make any changes to your order, you can \n"
          "do so by first adding it to your Saved Projects.\n"
          "Continue with saving or purchasing your order in-browser, and press enter to \n"
          "finish up once complete.\n")
