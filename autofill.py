# To package up as executable, run this in command prompt:
# pyinstaller --onefile --hidden-import=colorama --icon=favicon.ico autofill.py
import colorama
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import (
    NoAlertPresentException,
    UnexpectedAlertPresentException,
    NoSuchElementException,
    TimeoutException)
from selenium.webdriver.support.expected_conditions import invisibility_of_element
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import os
import sys
import xml.etree.ElementTree as ET
import numpy as np
import requests
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import queue

# Disable logging messages for webdriver_manager
os.environ['WDM_LOG_LEVEL'] = '0'

q_front = queue.Queue()
q_back = queue.Queue()
q_cardback = queue.Queue()

# On macOS, os.getcwd() doesn't work as expected - retrieve the executable's directory another way instead
if getattr(sys, 'frozen', False):
    currdir = os.path.dirname(os.path.realpath(sys.executable))
else:
    currdir = os.getcwd()

cards_folder = currdir + "/cards"
if not os.path.exists(cards_folder):
    os.mkdir(cards_folder)


def text_to_list(input_text):
    # Helper function to translate strings like "[2, 4, 5, 6]" into lists
    if input_text == "":
        return []
    return [int(x) for x in input_text.strip('][').replace(" ", "").split(',')]


def fill_cards(bar: tqdm, driver, root):
    # Load Custom Game Cards (63mm x 88mm) page
    driver.get("https://www.makeplayingcards.com/design/custom-blank-card.html")

    # Select card stock
    stock_dropdown = Select(driver.find_element_by_id("dro_paper_type"))
    stock_dropdown.select_by_visible_text(root[0][2].text)

    # Select number of cards
    qty_dropdown = Select(driver.find_element_by_id("dro_choosesize"))
    qty_dropdown.select_by_value(root[0][1].text)

    # Switch the finish to foil if the user ordered foil cards
    if root[0][3].text == "foil":
        foil_dropdown = Select(driver.find_element_by_id("dro_product_effect"))
        foil_dropdown.select_by_value("Holographic (card front)")

    # Accept current settings and move to next step
    driver.execute_script(
        "javascript:doPersonalize('https://www.makeplayingcards.com/products/pro_item_process_flow.aspx')")

    # Key in the desired number of cards, then move to the next step
    # TODO: can we do this with javascript / another way? currently it can be interrupted
    driver.switch_to.frame("sysifm_loginFrame")
    qtyfield = driver.find_element_by_id("txt_card_number")
    qtyfield.clear()
    qtyfield.send_keys(root[0][0].text)

    # Select "different images" for front
    driver.execute_script("javascript:setMode('ImageText', 0);")
    driver.switch_to.default_content()

    # Insert card fronts
    for i in range(0, len(cardsinfo_front)):
        curr_card = q_front.get()
        pid = upload_card(driver, curr_card[0])
        insert_card(driver, pid, curr_card[1])
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

        # Pull the common cardback card info off the queue, then upload and insert it
        curr_card = q_cardback.get()
        pid = upload_card(driver, curr_card[0])
        insert_card(driver, pid, [0])
        bar.update(1)

    else:
        # Different cardbacks
        driver.execute_script("javascript:setMode('ImageText', 0);")
        driver.switch_to.default_content()

        # Insert specified cardbacks
        cards_with_backs = []
        for i in range(0, len(cardsinfo_back)):
            curr_card = q_back.get()
            pid = upload_card(driver, curr_card[0])
            insert_card(driver, pid, curr_card[1])

            # Keep track of the back slots we've filled
            cards_with_backs.extend(curr_card[1])
            bar.update(1)

        # Determine which slots require the common cardback
        # TODO: Is there a more efficient way to do this? Look at DOM instead?
        total_cards = int(root[0][0].text)
        cards_needing_backs = [x for x in range(0, total_cards) if x not in cards_with_backs]

        # Upload and insert the common cardback
        curr_card = q_cardback.get()
        pid = upload_card(driver, curr_card[0])
        insert_card(driver, pid, cards_needing_backs)
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


def download_card(bar: tqdm, cardinfo):
    # Query google app to retrieve the card image with the specified drive ID
    # Credit to https://tanaikech.github.io/2017/03/20/download-files-without-authorization-from-google-drive/
    # The first request retrieves the file's name, so we can determine if it's been downloaded or not
    r_info = requests.post(
        "https://script.google.com/macros/s/AKfycbw90rkocSdppkEuyVdsTuZNslrhd5zNT3XMgfucNMM1JjhLl-Q/exec",
        data={"id": cardinfo[0]}
    )

    filename_split = r_info.json()["name"].rsplit(".", 1)
    filename = filename_split[0] + " (" + cardinfo[0] + ")." + filename_split[1]
    filepath = cards_folder + "/" + filename

    # Download the image if it doesn't exist, or if it does exist but it's empty
    if not os.path.isfile(filepath) or os.path.getsize(filepath) <= 0:
        # The second request for file contents
        # This is in a while loop so it'll request multiple times if the first request(/s) don't return valid data
        filecontents = []
        while len(filecontents) <= 0:
            r_contents = requests.post(
                "https://script.google.com/macros/s/AKfycbzJxEePf99FQYbnLhWQZXOayIRBg_ayoX5mrA4eA49F1PFDdJY/exec",
                data={"id": cardinfo[0]}
            )
            filecontents = r_contents.json()["result"]

        # Download the image
        f = open(filepath, "bw")
        f.write(np.array(filecontents, dtype=np.uint8))
        f.close()

    # Add to the appropriate queue
    card_item = (cards_folder + "/" + filename, text_to_list(cardinfo[1]))
    if cardinfo[2] == "front":
        q_front.put(card_item)
    elif cardinfo[2] == "back":
        q_back.put(card_item)
    elif cardinfo[2] == "cardback":
        q_cardback.put(card_item)

    # Increment progress bar
    bar.update(1)


def upload_card(driver, filepath):
    if os.path.isfile(filepath):
        num_elems = len(driver.find_elements_by_xpath("//*[contains(@id, 'upload_')]"))

        progress_container = driver.find_element_by_id("divFileProgressContainer")
        while progress_container.value_of_css_property("display") == "none":
            # Attempt to upload card until the upload progress bar appears
            driver.find_element_by_xpath('//*[@id="uploadId"]').send_keys(filepath)
            time.sleep(1)
            progress_container = driver.find_element_by_id("divFileProgressContainer")

        while True:
            try:
                # Wait until the image has finished uploading
                elem = driver.find_elements_by_xpath("//*[contains(@id, 'upload_')]")
                if len(elem) > num_elems:
                    # Return the uploaded card's PID so we can easily insert it into slots
                    return elem[-1].get_attribute("pid")

                time.sleep(1)
            except UnexpectedAlertPresentException:
                try:
                    alert = driver.switch_to.alert
                    alert.accept()
                except NoAlertPresentException:
                    pass
    else:
        return ValueError("Card image file not found.")


def insert_card(driver, pid, slots):
    # Use mpc's JS functions to insert cards without dragging/dropping
    driver.execute_script("javascript: l = PageLayout.prototype")
    for slot in slots:
        # Insert the card into each slot and wait for the page to load before continuing
        cmd = "javascript:l.applyDragPhoto(l.getElement3(\"dnImg\", {}), 0, \"{}\")".format(slot, pid)
        driver.execute_script(cmd)
        wait(driver)


if __name__ == "__main__":
    print("MPC Autofill initialising.")

    # Parse XML doc
    try:
        tree = ET.parse(currdir + "/cards.xml")
    except FileNotFoundError:
        try:
            tree = ET.parse(currdir + "/cards.xml.txt")
        except FileNotFoundError:
            input("cards.xml not found in this directory. Press enter to exit.")
            sys.exit(0)
    root = tree.getroot()

    # Retrieve google drive IDs
    cardsinfo_front = [(x[0].text, x[1].text, "front") for x in root[1]]
    cardsinfo_back = [(x[0].text, x[1].text, "back") for x in root[2]]
    cardsinfo_cardback = [(root[-1].text, "", "cardback")]
    cardsinfo = cardsinfo_front + cardsinfo_back + cardsinfo_cardback

    # On mpcautofill.com, the user can opt to not upload images to MPC, but rather to only download them
    if root[0][3].text == "true":
        print("Successfully read XML file. Starting card downloader process.")
        # Create ThreadPoolExecutor to download card images with, and a progress bar for downloading
        with ThreadPoolExecutor(max_workers=5) as pool, \
            tqdm(position=0, total=len(cardsinfo), desc="DL", leave=True) as dl_progress:
            # TODO: Not sure why this progress bar doesn't update like it does in the default autofill behaviour
            # TODO: Also not sure why the progress bar disappears
            for _ in pool.map(partial(download_card, dl_progress), cardsinfo):
                dl_progress.update(1)
            dl_progress.close()
        print("")
        input("All specified card images downloaded! Press enter to finish up.")
    else:
        print("Successfully read XML file. Starting card downloader and webdriver processes.")

        # Set up chrome driver window here to avoid tqdm issues
        chrome_options = Options()
        chrome_options.add_argument('--log-level=3')
        chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
        driver = webdriver.Chrome(ChromeDriverManager().install(), options=chrome_options)
        driver.set_window_size(1200, 900)
        driver.implicitly_wait(5)

        # Create ThreadPoolExecutor to download card images with, and progress bars for downloading and uploading
        with ThreadPoolExecutor(max_workers=5) as pool, \
            tqdm(position=0, total=len(cardsinfo), desc="DL", leave=True) as dl_progress, \
            tqdm(position=1, total=len(cardsinfo), desc="UL", leave=False) as ul_progress:
            # Download each card image in parallel, with the same progress bar input each time
            pool.map(partial(download_card, dl_progress), cardsinfo)
            # Launch the main webdriver automation function
            fill_cards(ul_progress, driver, root)
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
        sys.exit(1)
