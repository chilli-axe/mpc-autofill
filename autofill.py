import io
import os
import pickle
import threading
import time
import xml.etree.ElementTree as ET

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from selenium import webdriver
from selenium.common.exceptions import (NoAlertPresentException,
                                        NoSuchElementException,
                                        TimeoutException,
                                        UnexpectedAlertPresentException)
from selenium.webdriver import ActionChains
from selenium.webdriver.support.expected_conditions import \
    invisibility_of_element
from selenium.webdriver.support.ui import Select, WebDriverWait
from tqdm import tqdm

credentials = {
    "installed": {
        "client_id":
        "768699692145-8dlgu2tmfunlds97qrdjfgr8rhjlv5ea.apps.googleusercontent.com",
        "project_id": "quickstart-1586139074859",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url":
        "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": "qMuWaix3AyCBy-pjwhRTSyPq",
        "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"]
    }
}

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
"""
TODO:
- Handle the popup "your internet connection is slow so this'll take a while
- Would be nice to have a way of deselecting text bc sometimes the script selects a bunch of content on the page and
  it's slightly ugly
"""


def fill_cards(root):
    with webdriver.Chrome() as driver:
        driver.set_window_size(1200, 900)
        # Set implicit wait for driver
        driver.implicitly_wait(5)

        # Load Custom Game Cards (63mm x 88mm) page
        print('Configuring MPC For Upload...')
        driver.get(
            "https://www.makeplayingcards.com/design/custom-blank-card.html")

        # Select card stock
        stock_dropdown = Select(driver.find_element_by_id("dro_paper_type"))
        stock_dropdown.select_by_visible_text(root[0][2].text)

        # Select number of cards
        qty_dropdown = Select(driver.find_element_by_id("dro_choosesize"))
        qty_dropdown.select_by_value(root[0][1].text)

        # Accept current settings and move to next step
        driver.execute_script(
            "javascript:doPersonalize('https://www.makeplayingcards.com/products/pro_item_process_flow.aspx')"
        )

        # Key in the desired number of cards, then move to the next step
        driver.switch_to.frame("sysifm_loginFrame")
        qtyField = driver.find_element_by_id("txt_card_number")
        qtyField.clear()
        qtyField.send_keys(root[0][0].text)

        # Select "different images" for front
        driver.execute_script("javascript:setMode('ImageText', 0);")
        driver.switch_to.default_content()

        # Create list of cards slots
        # slots may contain one or more elements
        fronts_slot = [
            x[1].text.strip("][").replace(" ", "").split(",") for x in root[1]
        ]

        print('Uploading artwork...')
        autofillBtn = driver.find_element_by_class_name("autoFill")

        t = tqdm(range(0, len(root[1])), leave=True)
        for i in t:
            driveID = root[1][i][0].text
            t.set_description("Uploading: {}".format(driveID))
            elem = upload_card(driver, driveID)

            # try:
            # check if current slot is multi slot
            if len(fronts_slot[i]) > 1:
                for slot in fronts_slot[i]:
                    # drag and drop card into each slot (multi)
                    drag_drop_card(driver, elem, slot)
            # check if next slot is multi slot
            elif i + 1 < len(root[1]) and len(fronts_slot[i + 1]) > 1:
                # click autofill button to prepare for drag and drop
                autofillBtn.click()
                wait(driver)

            time.sleep(0.3)

        print('All card fronts uploaded!!')
        print('Auto filling remaining slots...')
        autofillBtn.click()
        wait(driver)

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
            print('Uploading Card Backs...')
            # Same cardback for every card
            driver.execute_script("javascript:setMode('ImageText', 1);")
            driver.switch_to.default_content()
            autofillBtn = driver.find_element_by_class_name("autoFill")
            upload_card(driver, root[-1].text)
            autofillBtn.click()
        else:
            # Different cardbacks
            driver.execute_script("javascript:setMode('ImageText', 0);")
            driver.switch_to.default_content()

            # Insert specified cardbacks
            print('Uploading Double Sided Card Backs...')
            cards_with_backs = []
            total_cards = int(root[0][0].text)
            for card in root[2]:
                # Append current cardbacks
                cards_with_backs.extend(card[1].text.strip('][').replace(
                    " ", "").split(','))
                upload_and_insert_card(
                    driver, card[0].text,
                    card[1].text.strip('][').replace(" ", "").split(','))

            # Cards that need cardbacks are in range(0, total_cards) - card indexes that already have backs
            print('Uploading Remaining Card Backs...')
            cards_with_backs = {int(x) for x in cards_with_backs}
            cards_needing_backs = [
                x for x in range(0, total_cards) if x not in cards_with_backs
            ]
            upload_and_insert_card(driver, root[3].text, cards_needing_backs)

        # Page through to finalise project
        print('Finalizing Project...')
        driver.execute_script("javascript:oDesign.setNextStep();")
        try:
            alert = driver.switch_to.alert
            alert.accept()
        except NoAlertPresentException:
            pass

        wait(driver)
        time.sleep(1)
        driver.execute_script("javascript:oDesign.setNextStep();")

        print('AutoFill Complete!')
        input(
            "Please continue with purchase in browser and press enter to finish up once complete."
        )


def wait(driver):
    try:
        wait_elem = driver.find_element_by_id("sysimg_wait")
        # wait for drag/drop upload. Modified as was breaking on large quantities
        while True:
            try:
                WebDriverWait(driver,
                              100).until(invisibility_of_element(wait_elem))
            except TimeoutException:
                print('Drag/Drop wait timed out.')
                print(
                    'If this repeats for several minutes you may want to check browser for issues.'
                )
                print('Restarting wait period...')
                continue
            break

    except NoSuchElementException:
        # wait was likely oo fast to catch so continue
        return


def download_card(driveID, service):
    # create the cards folder if it doesn't exist
    if not os.path.exists(os.getcwd() + r"\cards"):
        os.mkdir(os.getcwd() + r"\cards")
    filepath = os.getcwd() + r"\cards\{}.png".format(driveID)
    if os.path.exists(filepath):
        return
    request = service.files().get_media(fileId=driveID)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while done is False:
        status, done = downloader.next_chunk()

    with open(filepath, 'wb') as f:
        f.write(fh.getvalue())

    print("Finished downloading: {}".format(driveID))


def upload_card(driver, driveID):
    filepath = os.getcwd() + "\cards\{}.png".format(driveID)
    while not os.path.exists(filepath):
        time.sleep(1)

    if os.path.isfile(filepath):
        num_elems = len(
            driver.find_elements_by_xpath("//*[contains(@id, 'upload_')]"))
        driver.find_element_by_xpath('//*[@id="uploadId"]').send_keys(filepath)

        while True:
            try:
                # Wait until the image has finished uploading
                elem = driver.find_elements_by_xpath(
                    "//*[contains(@id, 'upload_')]")
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
    ActionChains(driver).click_and_hold(cardElement).move_to_element(
        elem_slot).release(elem_slot).perform()
    wait(driver)
    while driver.find_element_by_id("dnImg{}_0_0".format(slotNumber)) is None:
        time.sleep(0.3)
        ActionChains(driver).click_and_hold(cardElement).move_to_element(
            elem_slot).release(elem_slot).perform()
        wait(driver)


def login():
    creds = None
    # The file token.pickle stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_config(credentials, SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    return build('drive', 'v3', credentials=creds)


class CardDownloadThread(threading.Thread):
    def __init__(self, driveIDs):
        threading.Thread.__init__(self)
        self.driveIDs = driveIDs

    def run(self):
        print("Kicking off Google Drive downloader thread")
        service = login()
        for driveID in self.driveIDs:
            download_card(driveID, service)
        print("Downloaded all cards in the order")


class WebDriverThread(threading.Thread):
    def __init__(self, root):
        threading.Thread.__init__(self)
        self.root = root

    def run(self):
        print("Kicking off webdriver thread")
        fill_cards(self.root)


if __name__ == "__main__":
    # parse XML doc
    tree = ET.parse("cards.xml")
    root = tree.getroot()

    # retrieve google drive IDs for downloader thread
    driveIDs = [x[0].text for x in root[1]]
    driveIDs.extend([x[0].text for x in root[2]])
    driveIDs.extend([root[-1].text])

    # create each thread
    download_thread = CardDownloadThread(driveIDs=driveIDs)
    webdriver_thread = WebDriverThread(root)

    # start each thread
    download_thread.start()
    webdriver_thread.start()

    # join threads
    download_thread.join()
    webdriver_thread.join()
