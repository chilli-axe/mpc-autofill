from __future__ import print_function
import sqlite3
import pickle
import os.path
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import time
import imageio
import os

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/drive.readonly']


def create_connection(db_file):
    conn = None
    try:
        conn = sqlite3.connect(db_file)
    except sqlite3.Error as e:
        print(e)
    return conn


def get_top_parent(service, fileId):
    # get top level parent for a given folder - used to determine which drive
    # a card originated from
    while True:
        results = service.files().get(
            fileId=fileId,
            fields='id, name, parents'
        ).execute()

        if 'parents' not in results.keys():
            # found top level folder
            return results['name']
        else:
            fileId = results['parents'][0]
            time.sleep(0.1)


def fill_tables(conn):
    # add every card in my google drive to the database,
    # downloading its thumbnail and putting it in the thumbnail folder.
    c = conn.cursor()

    # Clear table to ensure only available cards are included
    c.execute("DELETE FROM cardpicker_card;")

    # Call to google drive API
    service = login()
    # driveId = "1CUaOPDZM84dk85Kvp6fGrqZVPDo4jQJo"  # "0AMFwuQwhIgJcUk9PVA"  # "1CUaOPDZM84dk85Kvp6fGrqZVPDo4jQJo"
    results = service.files().list(

        # TODO: Specify a drive? Can't seem to specify a drive ID without causing an error
        # includeItemsFromAllDrives=True,
        # corpora="drive",
        # supportsAllDrives=True,
        # driveId=driveId,

        q="mimeType='application/vnd.google-apps.folder'",
        fields="files(id, name, parents, driveId)")\
        .execute()
    folders = results.get('files', [])

    # Locate cards folder-by-folder
    for folder in folders:
        # Ignore tokens and planechase cards
        if folder['name'] in "9. Tokens, 11. Planechase":
            continue

        # Get the current folder's parent, to assign priority properly
        if 'parents' in folder.keys():
            parent = service.files().get(
                fileId=folder['parents'][0], fields='id, name'
            ).execute()

        else:
            parent = folder

        # service.files.get() defaults to a page of 100 results
        # while loop to retrieve information from all pages
        page_token = None
        top_parent = get_top_parent(service, folder['id'])
        print(folder['name'])
        print(top_parent)
        while True:
            time.sleep(0.1)
            items = service.files().list(
                q="mimeType='image/png' and '{}' in parents".format(folder['id']),
                fields="nextPageToken, files(id, name, trashed, driveId, properties)",
                pageToken=page_token
            ).execute()

            if len(items['files']) <= 0:
                break

            # print(items)
            for item in items['files']:
                if not item['trashed']:

                    # Determine card priority
                    priority = 2
                    if "Retro Cube" in parent['name']:
                        priority = 0
                    if ")" in item['name']:
                        priority = 1

                    # Download thumbnail
                    source = "Unknown"
                    if top_parent == "Chilli_Axe's MPC Proxies":
                        source = "Chilli_Axe"
                        if folder['name'] == "12. Cardbacks":
                            if "Black Lotus" in item['name']:
                                priority += 10
                            source += "_cardbacks"
                        priority += 30

                    elif folder['name'] == "nofacej MPC Card Backs":
                        source = "nofacej_cardbacks"
                        priority += 20

                    elif top_parent == "Bazukii's Proxies/Alters":
                        source = "Bazukii"
                        priority += 20

                    if "Basic" in folder['name']:
                        priority += 5

                    elif top_parent == "MPC Scryfall Scans":
                        source = folder['name']

                    folder_path = "./cardpicker/static/cardpicker/" + source
                    thumbnail_path = folder_path + "/" + item['id'] + ".png"

                    # if the folder to save into doesn't exist, create it
                    if not os.path.exists(folder_path):
                        os.makedirs(folder_path)

                    if not os.path.isfile(thumbnail_path):
                        print("Downloading: " + item['name'])
                        counter = 0
                        while counter < 3:
                            try:
                                # Read thumbnail
                                thumbnail = imageio.imread(
                                    "https://drive.google.com/thumbnail?sz=w400-h400&id=" + item['id']
                                )

                                # Trim off 11 pixels around the edges, which should remove the print bleed edge,
                                # assuming the image is 293 x 400 in resolution, before writing to disk
                                imageio.imwrite(thumbnail_path, thumbnail[13:-13, 13:-13, :])
                                break
                            except:  # TODO: Not bare except
                                counter += 1

                        if counter >= 3:
                            print(item['name'])

                    # Insert into database
                    sql_insert = """INSERT OR REPLACE INTO cardpicker_card VALUES (?,?,?,?)"""
                    c.execute(sql_insert, (item['id'], item['name'], source, priority))

            conn.commit()
            page_token = items.get('nextPageToken', None)
            if page_token is None:
                break

        print("")


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
    conn = create_connection("./card_db.db")
    service = login()
    fill_tables(conn)
    print("Finished.")
