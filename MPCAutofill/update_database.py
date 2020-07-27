import sqlite3
import pickle
import os.path
from googleapiclient.errors import HttpError
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import time
import imageio
import os
import datetime
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from tqdm import tqdm
import re
from to_searchable import to_searchable
import colorama

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/drive.readonly']

global SOURCES
SOURCES = {"Chilli_Axe": {"quantity": 0,
                          "username": "u/Chilli_Axe",
                          "reddit": "https://www.reddit.com/user/Chilli_Axe/",
                          "drivelink": "https://drive.google.com/open?id=1CUaOPDZM84dk85Kvp6fGrqZVPDo4jQJo",
                          "description": "cards rendered at 1200 DPI in Photoshop"},
           "Chilli_Axe_cardbacks": {"quantity": 0,
                                    "username": "u/Chilli_Axe",
                                    "reddit": "https://www.reddit.com/user/Chilli_Axe/",
                                    "drivelink": "https://drive.google.com/open?id=1CUaOPDZM84dk85Kvp6fGrqZVPDo4jQJo",
                                    "description": "custom cardbacks rendered at 1200 DPI in Photoshop"},
           "Proxycommander": {"quantity": 0,
                              "username": "u/proxycommander",
                              "reddit": "https://www.reddit.com/user/proxycommander/",
                              "drivelink": "https://drive.google.com/drive/folders/1z5Xa1qiT5Tbhx4wJH1jQWR74AbkyeZ_R",
                              "description": "cards rendered at 1200 DPI in Photoshop, including masterpieces and expeditions"},
           "nofacej_cardbacks": {"quantity": 0,
                                 "username": "u/nofacej",
                                 "reddit": "https://www.reddit.com/user/nofacej/",
                                 "drivelink": "https://drive.google.com/drive/folders/1xbWFU2bXCTit1Nvij2GIuzfTUVRVtf3N",
                                 "description": "custom cardbacks, in a style based on MTG Arena's wildcards at 310 DPI"},
           "Bazukii": {"quantity": 0,
                       "username": "u/Bazukii",
                       "reddit": "https://www.reddit.com/user/Bazukii/",
                       "drivelink": "https://drive.google.com/open?id=17whjecbdN1Z463FuEH5Lb7V28qph5pat",
                       "description": "custom cards rendered at 1220 DPI in Photoshop, in a variety of creative styles"},
           "hathwellcrisping": {"quantity": 0,
                                "username": "u/hathwellcrisping",
                                "reddit": "https://www.reddit.com/user/hathwellcrisping/",
                                "drivelink": "https://drive.google.com/open?id=1LnLsMSSmNs0TPnSzVuS86O153N_6d7LH",
                                "description": "cards rendered at 1220 DPI in Photoshop"},
           "male_MPC": {"quantity": 0,
                        "username": "u/male_MPC",
                        "reddit": "https://www.reddit.com/user/hathwellcrisping/",
                        "drivelink": "https://drive.google.com/open?id=1UipyGTz1HMJ6B3V_uJ-Hs1Aoe1bSZsRn",
                        "description": "cards rendered in a dark frame with extended art at 300 DPI"},
           "iDerp69": {"quantity": 0,
                       "username": "u/iDerp69",
                       "reddit": "https://www.reddit.com/user/iderp69",
                       "drivelink": "https://drive.google.com/drive/u/0/folders/0B-S9ADELGMXOM195OUp1VXJpVG8",
                       "description": "cards in a unique, classicshifted style at 600 DPI"},
           "Celid_of_the_wind": {"quantity": 0,
                                 "username": "Celid_of_the_wind",
                                 "reddit": "https://www.reddit.com/user/Celid_of_the_wind",
                                 "drivelink": "https://drive.google.com/drive/folders/1bGGJAClFd-FYrSNWPi2QNDt7A5BAVJnq",
                                 "description": "cards in a style inspired by ASAPproxies"},
           "MrChow1917": {"quantity": 0,
                          "username": "u/MrChow1917",
                          "reddit": "https://www.reddit.com/user/MrChow1917",
                          "drivelink": "https://drive.google.com/drive/folders/1KkbGl_-quZHZeBpMv6yWk3U-GsM8wkrH?usp=sharing",
                          "description": "cards in the Dan Mumford Horror Series"},
           "berndt_toast83": {"quantity": 0,
                              "username": "u/berndt_toast83",
                              "reddit": "https://www.reddit.com/user/berndt_toast83",
                              "drivelink": "https://drive.google.com/open?id=13oOobsLCqbhTM-A0JeWTOT0KJ6UZiDkW",
                              "description": "Scryfall scans, processed and cleaned to be print-ready at 470 DPI"},
           "Unknown": {"quantity": 0,
                       "username": "",
                       "reddit": "",
                       "drivelink": "",
                       "description": ""}
           }

DPI_HEIGHT_RATIO = 300/1100  # 300 DPI for image of vertical resolution 1100 pixels


def create_connection(db_file):
    conn = None
    try:
        conn = sqlite3.connect(db_file)
    except sqlite3.Error as e:
        print(e)
    return conn


def fill_tables(conn):
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS cardpicker_card (
        id text PRIMARY KEY,
        name text,
        priority integer,
        source text,
        dpi integer,
        searchq text,
        thumbpath text);""")

    db_datetime = datetime.datetime.fromtimestamp(os.path.getmtime("./card_db.db")) - datetime.timedelta(days=1)
    print("Date & time to check for updates to thumbnails for: " + str(db_datetime))

    # add every card in my google drive to the database,
    # downloading its thumbnail and putting it in the thumbnail folder.

    # Call to google drive API
    service = login()
    results = service.files().list(
        q="mimeType='application/vnd.google-apps.folder' and sharedWithMe=true",
        fields="files(id, name, parents, driveId)",
        pageSize=1000
    ).execute()

    folders = results.get('files', [])
    print("Folders found: {}".format(len(folders)))

    queries = []
    for folder in folders:
        queries.append(search_folder(folder, db_datetime))
    # search_folder(c, folders[1], db_datetime)

    # Commit changes all at once
    # Clear table to ensure only available cards are included
    c.execute("DELETE FROM cardpicker_card;")
    for queryset in queries:
        for card in queryset:
            c.execute("""INSERT OR REPLACE INTO cardpicker_card VALUES (?,?,?,?,?,?,?)""", card)
    conn.commit()


def search_folder(folder, db_datetime):
    # folders to skip
    unacceptableFolders = [
        'Tokens',
        '3x5 Size',
        '11. Planechase',
        '!Chili_Axe Card Backs',
        '!Card Backs',
        '[EXTRA] - Card back',
        '[Update 6/5/18] Legendary Walkers',
        '[Update: 6/10/18] Redirect & Misc Errata',
        'Cubes',
    ]

    print("Searching drive: {}".format(folder['name']))

    folderList = [folder]
    imageList = []
    folderDict = {}
    parentDict = {}

    while len(folderList) > 0:
        # Add all folders within the current folder to the folder list
        # Add all images within the current folder to the images list
        # Remove the current folder from the folder list
        # The next current folder is the 1st element in the folder list
        time.sleep(0.1)
        currFolder = folderList[0]
        # Skip some folders as specified
        acceptable = all(x not in currFolder['name'] for x in unacceptableFolders)
        if acceptable:
            print("Searching: {}".format(currFolder['name']))
            folderDict[currFolder['id']] = currFolder['name']
            try:
                parentDict[currFolder['id']] = folderDict[currFolder['parents'][0]]
            except KeyError:
                parentDict[currFolder['id']] = ""

            # Search for folders within the current folder
            while True:
                try:
                    results = service.files().list(
                        q="mimeType='application/vnd.google-apps.folder' and "
                          "'{}' in parents".format(currFolder['id']),
                        fields="files(id, name, parents)",
                        pageSize=500
                    ).execute()
                    folderList += results.get('files', [])
                    break
                except HttpError:
                    pass

            # Search for images with paging - probably not necessary for folders
            page_token = None
            while True:
                # Search for all images within this folder
                time.sleep(0.1)
                try:
                    results = service.files().list(
                        q="(mimeType contains 'image/png' or "
                          "mimeType contains 'image/jpg' or "
                          "mimeType contains 'image/jpeg') and "
                          "'{}' in parents".format(currFolder['id']),
                        fields="nextPageToken, "
                               "files(id, name, trashed, properties, parents, modifiedTime, imageMediaMetadata, owners)",
                        pageSize=500,
                        pageToken=page_token
                    ).execute()
                except HttpError:
                    # TODO: Not pass?
                    pass

                if len(results['files']) <= 0:
                    break

                print("Found {} image(s)".format(len(results.get('files', []))))

                # Append the retrieved images to the image list
                imageList += results.get('files', [])

                page_token = results.get('nextPageToken', None)
                if page_token is None:
                    break
        folderList.remove(currFolder)

    print("Number of images found: {}".format(len(imageList)))
    print("Folder dict:")
    for key in folderDict:
        print("{}: {}".format(key, folderDict[key]))

    queries = []

    # add the retrieved cards to the database, parallelised by 20 for speed
    # TODO: Is 20 the right number here?
    with tqdm(total=len(imageList), desc="Inserting into DB") as bar, ThreadPoolExecutor(max_workers=20) as pool:
        for result in pool.map(partial(add_card, folderDict, parentDict, folder, db_datetime), imageList):
            queries.append(result)
            # c.execute("""INSERT OR REPLACE INTO cardpicker_card VALUES (?,?,?,?,?,?,?)""", result)
            bar.update(1)

    print("Finished crawling {}".format(folder['name']))
    print("")
    return queries


def add_card(folderDict, parentDict, folder, db_datetime, item):
    if not item['trashed']:
        folderName = folderDict[item['parents'][0]]
        parentName = parentDict[item['parents'][0]]

        owner = item['owners'][0]['displayName']

        folders_sources = {
            "Jake Rowe": "nofacej_cardbacks",
            "Bazuki Alters": "Bazukii",
            "Karlin Courtney": "hathwellcrisping",
            "Digital Red": "Proxycommander",
            "Alastair Jack": "male_MPC",
            "i Derp": "iDerp69",
            "Trey Kapfer": "MrChow1917",
            "Tristan DELMAS": "Celid_of_the_wind"
        }

        scryfall = False
        priority = 2
        if "Retro Cube" in parentName:
            priority = 0
        if ")" in item['name']:
            priority = 1
        source = "Unknown"
        if folder['name'] == "Chilli_Axe's MPC Proxies":
            source = "Chilli_Axe"
            if folderName == "12. Cardbacks":
                if "Black Lotus" in item['name']:
                    priority += 10
                source += "_cardbacks"
                priority += 5

        elif owner in folders_sources.keys():
            source = folders_sources[owner]

        elif folder['name'] == "MPC Scryfall Scans":
            source = "berndt_toast83/" + folderName
            scryfall = True

        if "Basic" in folderName:
            priority += 5

        if scryfall:
            SOURCES["berndt_toast83"]["quantity"] += 1
        else:
            SOURCES[source]["quantity"] += 1
        folder_path = "./../staticroot/cardpicker/" + source
        # folder_path = "cardpicker/static/cardpicker/" + source

        folder_path = os.path.abspath(folder_path)

        # Download card thumbnail if necessary
        file_datetime = datetime.datetime.strptime(
            item["modifiedTime"], "%Y-%m-%dT%H:%M:%S.%fZ"
        )

        thumbnail_path = folder_path + "/" + item['id'] + ".png"
        try:
            if not os.path.exists(folder_path):
                os.makedirs(folder_path)
        except FileExistsError:
            pass

        # Calculate source image DPI, rounded to tens
        dpi = 10 * round(int(item['imageMediaMetadata']['height']) * DPI_HEIGHT_RATIO / 10)

        if not os.path.isfile(thumbnail_path) or file_datetime > db_datetime:
            # three tries at downloading the file
            counter = 0
            while counter < 3:
                try:
                    # Read thumbnail
                    thumbnail = imageio.imread(
                        "https://drive.google.com/thumbnail?sz=w400-h400&id=" + item['id']
                    )

                    # Trim off 13 pixels around the edges, which should remove the print bleed edge,
                    # assuming the image is 293 x 400 in resolution, before writing to disk
                    imageio.imwrite(thumbnail_path, thumbnail[13:-13, 13:-13, :])
                    break
                except:  # TODO: Not bare except
                    counter += 1
            if counter >= 3:
                print("Failed to download thumbnail for: {}".format(item['name']))

        # Remove the file extension from card name
        cardname = '.'.join(item['name'].split(".")[0:-1])

        # Store the image's static URL as well
        static_url = "cardpicker/" + source + "/" + item['id'] + ".png"

        # Return card info so we can insert into database
        return item['id'], cardname, priority, source, dpi, to_searchable(cardname), static_url


def add_sources(conn):
    c = conn.cursor()

    c.execute("""CREATE TABLE IF NOT EXISTS cardpicker_source (
    id text PRIMARY KEY,
    quantity integer,
    username text,
    reddit text,
    drivelink text,
    description text);""")

    source_ids = list(SOURCES.keys())
    source_ids.remove("Unknown")
    source_ids.remove("Chilli_Axe_cardbacks")
    for source_id in source_ids:
        c.execute("INSERT OR REPLACE INTO cardpicker_source VALUES (?,?,?,?,?,?)",
                  (source_id,
                   SOURCES[source_id]['quantity'],
                   SOURCES[source_id]['username'],
                   SOURCES[source_id]['reddit'],
                   SOURCES[source_id]['drivelink'],
                   SOURCES[source_id]['description']))
    conn.commit()


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
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    return build('drive', 'v3', credentials=creds)


if __name__ == "__main__":
    with create_connection("./card_db.db") as conn:
        service = login()
        t = time.time()
        fill_tables(conn)
        add_sources(conn)
        print(SOURCES)
        print("Elapsed time: {} minutes.".format((time.time() - t) / 60))
    input("Finished.")
