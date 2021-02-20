from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.core import management
from cardpicker.models import Card, Cardback, Token, Source
import pickle
from googleapiclient.errors import HttpError
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import time
import os
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from tqdm import tqdm
from to_searchable import to_searchable
import colorama
import csv
from math import floor


def int_mean(input_list):
    # cleaned_list = [x for x in input_list if x.isdigit()]
    if len(input_list) == 0:
        return 0
    try:
        return int(sum(input_list)/len(input_list))
    except ZeroDivisionError:
        return 0


# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/drive.readonly']

global SOURCES
SOURCES = {}

q_cards = []
q_cardbacks = []
q_tokens = []


# read CSV file for drive data
with open("drives.csv", newline='') as csvfile:
    drivesreader = csv.DictReader(csvfile, delimiter=",")
    # order the sources by row number in CSV
    i = 0
    for row in drivesreader:
        SOURCES[row["key"]] = {
            "qty_cards": 0,
            "qty_cardbacks": 0,
            "qty_tokens": 0,
            "username": row["username"],
            "reddit": row["reddit"],
            "drivelink": row["drivelink"],
            "description": row["description"],
            "drivename": row["drivename"],
            "order": i,
        }
        i += 1

global OWNERS
OWNERS = {SOURCES[x]["drivename"]: x for x in SOURCES.keys()}

DPI_HEIGHT_RATIO = 300/1122  # 300 DPI for image of vertical resolution 1122 pixels


def fill_tables(service, drive):
    # Call to google drive API
    results = service.files().list(
        q="mimeType='application/vnd.google-apps.folder' and sharedWithMe=true",
        fields="files(id, name, parents, driveId, owners)",
        pageSize=1000
    ).execute()

    folders = results.get('files', [])
    print("Folders found: {}".format(len(folders)))

    if drive:
        # drive to update specified
        searched_drive = False
        for folder in folders:
            # look through the returned folders for the specified one
            if folder['owners'][0]['displayName'] == SOURCES[drive]['drivename']:
                search_folder(service, folder)
                searched_drive = True
                break

        # user feedback if couldn't find the drive
        if not searched_drive:
            print("Couldn't find the specified drive.")
            return

        with connection.cursor() as cursor:
            print("Wiping cards from: {}".format(drive))
            cursor.execute('DELETE FROM cardpicker_card WHERE source = %s', [drive])
            cursor.execute('DELETE FROM cardpicker_cardback WHERE source = %s', [drive])
            cursor.execute('DELETE FROM cardpicker_token WHERE source = %s', [drive])
    else:
        # wipe and rebuild all
        for folder in folders:
            search_folder(service, folder)

        with connection.cursor() as cursor:
            print("Wiping all cards")
            cursor.execute('DELETE FROM cardpicker_card')
            cursor.execute('DELETE FROM cardpicker_cardback')
            cursor.execute('DELETE FROM cardpicker_token')

    # Commit changes for each table in bulk
    print("Committing cards to tables")

    Card.objects.bulk_create(
        list([Card(
            id=x[0],
            name=x[1],
            priority=x[2],
            source=x[3],
            dpi=x[4],
            searchq=x[5],
            thumbpath=x[6],
            date=x[7]
        ) for x in q_cards])
    )

    Cardback.objects.bulk_create(
        list([Cardback(
            id=x[0],
            name=x[1],
            priority=x[2],
            source=x[3],
            dpi=x[4],
            searchq=x[5],
            thumbpath=x[6],
            date=x[7]
        ) for x in q_cardbacks])
    )

    Token.objects.bulk_create(
        list([Token(
            id=x[0],
            name=x[1],
            priority=x[2],
            source=x[3],
            dpi=x[4],
            searchq=x[5],
            thumbpath=x[6],
            date=x[7]
        ) for x in q_tokens])
    )

    print("Done with cards")


def search_folder(service, folder):
    # folders to skip
    ignoredFolders = [
        '3x5 Size',
        '3.5x5 Size',
        '11. Planechase',
        # '!Chili_Axe Card Backs',
        # '!Card Backs',
        '[EXTRA] - Card back',
        '[Update 6/5/18] Legendary Walkers',
        '[Update: 6/10/18] Redirect & Misc Errata',
        'Cubes',
        'X. Art & Misc Stuff',
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
        acceptable = all(x not in currFolder['name'] for x in ignoredFolders) and currFolder['name'][0] != "!"
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
                        fields="nextPageToken, files("
                               "id, name, trashed, size, properties, parents, createdTime, imageMediaMetadata, owners"
                               ")",
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

    # add the retrieved cards to the database, parallelised by 20 for speed
    # TODO: Is 20 the right number here? seems fine so far?
    with tqdm(total=len(imageList), desc="Collecting card results") as bar, ThreadPoolExecutor(max_workers=20) as pool:
        for _ in pool.map(partial(add_card, folderDict, parentDict, folder), imageList):
            bar.update(1)

    print("Finished crawling {}".format(folder['name']))
    print("")


def add_card(folderDict, parentDict, folder, item):
    try:
        # file is valid when it's not trashed and filesize does not exceed 30 MB
        valid = not item['trashed'] and int(item['size']) < 30000000
        if not valid:
            print("Can't index this card: {}".format(item))
    except KeyError:
        valid = True

    if valid:
        # strip the extension off of the item name to retrieve the card name
        try:
            [cardname, extension] = item['name'].rsplit('.', 1)
        except ValueError:
            print("nani {}".format(item['name']))
            return

        img_type = "normal"
        folderName = folderDict[item['parents'][0]]
        parentName = parentDict[item['parents'][0]]

        owner = item['owners'][0]['displayName']

        scryfall = False
        priority = 2
        if "Retro Cube" in parentName:
            priority = 0
        if ")" in cardname:
            priority = 1
        source = "Unknown"
        if folder['name'] == "Chilli_Axe's MPC Proxies":
            source = "Chilli_Axe"
            if folderName == "12. Cardbacks":
                if "Black Lotus" in item['name']:
                    priority += 10
                img_type = "cardback"
                priority += 5

        elif folder['name'] == "nofacej MPC Card Backs":
            img_type = "cardback"
            source = "nofacej"

        # this elif and the next one were the other way around - swap them back if shit breaks
        elif folder['name'] == "MPC Scryfall Scans":
            source = "berndt_toast83/" + folderName
            scryfall = True

        elif owner in OWNERS:
            source = OWNERS[owner]

        if "basic" in folderName.lower():
            priority += 5

        elif "token" in folderName.lower():
            img_type = "token"

        elif "cardbacks" in folderName.lower() or "card backs" in folderName.lower():
            img_type = "cardback"

        # Store the image's static URL
        static_url = "https://drive.google.com/thumbnail?sz=w400-h400&id=" + item['id']

        # Calculate source image DPI, rounded to tens
        dpi = 10 * round(int(item['imageMediaMetadata']['height']) * DPI_HEIGHT_RATIO / 10)

        # Return card info so we can insert into database, in the correct list
        card_info = (item['id'], cardname, priority, source, dpi, to_searchable(cardname), extension, item['createdTime'])

        # Skip card if its source couldn't be determined
        if source == "Unknown":
            return
        
        if img_type == "cardback":
            q_cardbacks.append(card_info)
            if scryfall:
                SOURCES["berndt_toast83"]["qty_cardbacks"] += 1
            else:
                SOURCES[source]["qty_cardbacks"] += 1
        elif img_type == "token":
            q_tokens.append(card_info)
            if scryfall:
                SOURCES["berndt_toast83"]["qty_tokens"] += 1
            else:
                SOURCES[source]["qty_tokens"] += 1
        else:
            q_cards.append(card_info)
            if scryfall:
                SOURCES["berndt_toast83"]["qty_cards"] += 1
            else:
                SOURCES[source]["qty_cards"] += 1


def add_sources(drive):
    source_ids = list(SOURCES.keys())
    # source_ids.remove("Unknown")

    if drive:
        with connection.cursor() as cursor:
            print("Rebuilding source: {}".format(drive))
            cursor.execute('DELETE FROM cardpicker_source WHERE id = %s', [drive])

        source_dpis = []
        for model in [Card, Cardback, Token]:
            source_dpis.extend(list(model.objects.filter(source__startswith=drive).values_list('dpi', flat=True)))

        Source.objects.create(
            id=drive,
            qty_cards=SOURCES[drive]['qty_cards'],
            qty_cardbacks=SOURCES[drive]['qty_cardbacks'],
            qty_tokens=SOURCES[drive]['qty_tokens'],
            username=SOURCES[drive]['username'],
            reddit=SOURCES[drive]['reddit'],
            drivelink=SOURCES[drive]['drivelink'],
            description=SOURCES[drive]['description'],
            avgdpi=int_mean(source_dpis),
            order=SOURCES[drive]['order']
        )

        print(SOURCES[drive])

        
    else:
        with connection.cursor() as cursor:
            print("Rebuilding all sources")
            cursor.execute('DELETE FROM cardpicker_source')

        for source_id in source_ids:
            source_dpis = []
            for model in [Card, Cardback, Token]:
                source_dpis.extend(list(model.objects.filter(source__startswith=source_id).values_list('dpi', flat=True)))

            Source.objects.create(
                id=source_id,
                qty_cards=SOURCES[source_id]['qty_cards'],
                qty_cardbacks=SOURCES[source_id]['qty_cardbacks'],
                qty_tokens=SOURCES[source_id]['qty_tokens'],
                username=SOURCES[source_id]['username'],
                reddit=SOURCES[source_id]['reddit'],
                drivelink=SOURCES[source_id]['drivelink'],
                description=SOURCES[source_id]['description'],
                avgdpi=int_mean(source_dpis),
                order=SOURCES[source_id]['order']
            )

        for source in SOURCES:
            print(SOURCES[source])

    print("Done with sources")


def add_transforms():
    pass
    # TODO: store transform pairs in database so we don't need to hardcode the pairs in search_functions
    # https://api.scryfall.com/cards/search?q=is:dfc%20-layout:art_series%20-layout:double_faced_token


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


class Command(BaseCommand):
    # set up help line to print the available drive options
    help = "You may specify one of the following drives: "
    for source in SOURCES.keys():
        help += "{}, ".format(source)
    help = help[:-2]

    def add_arguments(self, parser):
        parser.add_argument('-d', '--drive', type=str, help='Only update a specific drive', )

    def handle(self, *args, **kwargs):
        # user can specify which drive should be searched - if no drive is specified, search all drives
        drive = kwargs['drive']
        if drive:
            if drive not in SOURCES.keys():
                print("Invalid drive specified: {}".format(drive))
                return
            else:
                print("Rebuilding database for specific drive: {}".format(drive))
        else:
            print("Rebuilding database with all drives")

        service = login()
        t = time.time()
        fill_tables(service, drive)
        add_sources(drive)
        
        t_final = time.time()
        mins = floor((t_final - t) / 60)
        secs = int((t_final - t) - mins * 60)
        print("Elapsed time: {} minutes and {} seconds.\n".format(mins, secs))

        print("Rebuilding search index")
        management.call_command('search_index', '--rebuild', '-f')
