from django.core.management.base import BaseCommand
from django.db.models import Q
from django.core import management
from cardpicker.models import Card, Cardback, Token, Source
from bulk_sync import bulk_sync
import pickle
from googleapiclient.errors import HttpError
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import time
import os
from to_searchable import to_searchable
from math import floor

# cron job to run this cmd daily: 0 0 * * * bash /root/mpc-autofill/update_database >> /root/db_update.txt 2>&1

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/drive.readonly']

DPI_HEIGHT_RATIO = 300/1122  # 300 DPI for image of vertical resolution 1122 pixels


def locate_drives(service):
    # Call to google drive API
    results = service.files().list(
        q="mimeType='application/vnd.google-apps.folder' and sharedWithMe=true",
        fields="files(id, name, parents, driveId, owners)",
        pageSize=1000
    ).execute()

    folders = results.get('files', [])
    print("Folders found: {}".format(len(folders)))

    return folders


def map_drives(folders):
    # correlate the folders retrieved by gdrive api with Source objects in database
    print("Mapping Sources to Drives.")
    sources = {}
    for x in folders:
        try:
            folder_name = x['owners'][0]['displayName']
            curr_source = Source.objects.get(drivename=folder_name)
            sources[curr_source.id] = x
        except Source.DoesNotExist:
            print("Failed to find Source for drive owned by < {} >".format(folder_name))

    print("")
    return sources


def crawl_drive(service, folder):
    print("Beginning crawling drive: {}".format(folder['name']))
    # maintain a list of images found in this folder so far, and also maintain a list of 
    # unexplored folders in this drive
    unexplored_folders = [folder]
    folder_dict = {}

    # skip any folders with these names
    ignored_folders = [
        '3x5 Size',
        '3.5x5 Size',
        '11. Planechase',
        '[EXTRA] - Card back',
        '[Update 6/5/18] Legendary Walkers',
        '[Update: 6/10/18] Redirect & Misc Errata',
        'Cubes',
        'X. Art & Misc Stuff',
    ]

    # crawl through the drive one folder at a time
    images = []
    while len(unexplored_folders) > 0:
        # explore the first folder in the list - retrieve all images in the folder, add any folders inside it
        # to the unexplored folder list, then remove the current folder from that list, then repeat untill all
        # folders have been explored
        time.sleep(0.1)
        curr_folder = unexplored_folders[0]

        # Skip some folders as specified
        acceptable = all(x not in curr_folder['name'] for x in ignored_folders) and curr_folder['name'][0] != "!"
        if acceptable:
            print("Searching: {}".format(curr_folder['name']))

            # Store this folder's name in a dict with gdrive ID as keys for tracking parent folder names for cards
            folder_dict[curr_folder['id']] = curr_folder['name']

            # Search for folders within the current folder
            while True:
                try:
                    results = service.files().list(
                        q="mimeType='application/vnd.google-apps.folder' and "
                          "'{}' in parents".format(curr_folder['id']),
                        fields="files(id, name, parents)",
                        pageSize=500
                    ).execute()
                    unexplored_folders += results.get('files', [])
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
                          "'{}' in parents".format(curr_folder['id']),
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
                located_images = results.get('files', [])
                for x in located_images:
                    # Store references to current folder name and parent name in each image
                    x['folder_name'] = curr_folder['name']
                    try:
                        x['parent_name'] = folder_dict[curr_folder['parents'][0]]
                    except KeyError:
                        x['parent_name'] = ""

                images += results.get('files', [])

                page_token = results.get('nextPageToken', None)
                if page_token is None:
                    break
        
        # once we're finished exploring this folder, remove it from the unexplored folder list
        unexplored_folders.remove(curr_folder)

    return images


def search_folder(service, source, folder):
    print("Searching drive: {}\n".format(source.id))

    # maintain list of cards, cardbacks, and tokens found for this Source
    q_cards = []
    q_cardbacks = []
    q_tokens = []

    # crawl the drive to retrieve a complete list of images it contains
    images = crawl_drive(service, folder)
    print("Number of images found: {}".format(len(images)))

    # add the retrieved cards to the database
    for x in images:
        add_card(folder, source, x, q_cards, q_cardbacks, q_tokens)

    print("\nFinished crawling {}.\nSynchronising to database.".format(folder['name']))

    # set up key fields and filter for bulk_sync on this Source, then synchronise the located cards
    t0 = time.time()
    key_fields = ('id', )
    source_filter = Q(source=source.id)

    # Synchronise q_cards with Cards, q_cardbacks with Cardbacks, and q_tokens with Tokens
    queue_object_map = [
        (q_cardbacks, Cardback),
        (q_tokens, Token),
        (q_cards, Card)
    ]

    for x in queue_object_map:
        ret1 = bulk_sync(
            new_models=x[0],
            key_fields=key_fields,
            filters=source_filter,
            db_class=x[1]
        )

    print("Finished synchronising to database, which took {} seconds.\n".format(time.time() - t0))


# def add_card(folderDict, parentDict, folder, source, item, q_cards, q_cardbacks, q_tokens):
def add_card(folder, source, item, q_cards, q_cardbacks, q_tokens):
    try:
        # file is valid when it's not trashed and filesize does not exceed 30 MB
        valid = not item['trashed'] and int(item['size']) < 30000000
        if not valid:
            print("Can't index this card: <{}> {}, size: {} bytes".format(item['id'], item['name'], item['size']))
    except KeyError:
        valid = True

    if valid:
        # strip the extension off of the item name to retrieve the card name
        try:
            [cardname, extension] = item['name'].rsplit('.', 1)
        except ValueError:
            print("Issue with parsing image: {}".format(item['name']))
            return

        source_verbose = "Unknown"

        img_type = "card"
        folder_name = item['folder_name']
        parent_name = item['parent_name']

        # Skip this file if it doesn't belong to this Source, or if it doesn't have a name
        owner = item['owners'][0]['displayName']
        if owner != source.drivename or not cardname:
            print("whoops")
            return

        scryfall = False
        priority = 2

        if ")" in cardname:
            priority = 1
        
        if folder['name'] == "Chilli_Axe's MPC Proxies":
            source_verbose = "Chilli_Axe"

            if "Retro Cube" in parent_name:
                priority = 0
                source_verbose = "Chilli_Axe Retro Cube"

            elif folder_name == "12. Cardbacks":
                if "Black Lotus" in item['name']:
                    priority += 10
                img_type = "cardback"
                priority += 5

        elif folder['name'] == "nofacej MPC Card Backs":
            img_type = "cardback"
            source_verbose = source.id

        elif folder['name'] == "MPC Scryfall Scans":
            source_verbose = "berndt_toast83/" + folder_name
            scryfall = True

        else:
            source_verbose = source.id

        if "basic" in folder_name.lower():
            priority += 5
            source_verbose = source_verbose + " Basics"

        elif "token" in folder_name.lower():
            img_type = "token"
            if not scryfall:
                source_verbose = source_verbose + " Tokens"

        elif "cardbacks" in folder_name.lower() or "card backs" in folder_name.lower():
            img_type = "cardback"
            source_verbose = source_verbose + " Cardbacks"

        # Calculate source image DPI, rounded to tens
        dpi = 10 * round(int(item['imageMediaMetadata']['height']) * DPI_HEIGHT_RATIO / 10)

        # Skip card if its source couldn't be determined
        if source == "Unknown":
            return

        # Use a dictionary to map the img type to the queue and class of card we need to append/create
        queue_object_map = {
            "cardback": (q_cardbacks, Cardback),
            "token": (q_tokens, Token),
            "card": (q_cards, Card)
        }

        queue_object_map[img_type][0].append(
                queue_object_map[img_type][1](
                    id=item['id'],
                    name=cardname,
                    priority=priority,
                    source=source,
                    source_verbose=source_verbose,
                    dpi=dpi,
                    searchq=to_searchable(cardname),
                    thumbpath=extension,
                    date=item['createdTime']
                )
            )


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
    for source in Source.objects.all():
        help += "{}, ".format(source.id)
    help = help[:-2]

    def add_arguments(self, parser):
        parser.add_argument('-d', '--drive', type=str, help='Only update a specific drive', )

    def handle(self, *args, **kwargs):
        # user can specify which drive should be searched - if no drive is specified, search all drives
        drive = kwargs['drive']

        service = login()
        t = time.time()

        # locate all folders this gdrive account has access to, then correlate them with Source objects
        folders = locate_drives(service)
        sources = map_drives(folders)

        # If a valid drive was specified, search only that drive - otherwise, search all drives
        if drive:
            # Try/except to see if the given drive name maps to a Source
            try:
                drive_source = sources[drive]
                print("Rebuilding database for specific drive: {}.".format(drive))
                search_folder(service, Source.objects.get(id=drive), sources[drive])
            except KeyError:
                print("Invalid drive specified: {}\nYou may specify one of the following drives:".format(drive))
                [print(x.id) for x in Source.objects.all()]
                return
        else:
            print("Rebuilding database with all drives.")
            for x in sources:
                search_folder(service, Source.objects.get(id=x), sources[x])

        t_final = time.time()
        mins = floor((t_final - t) / 60)
        secs = int((t_final - t) - mins * 60)
        print("Total elapsed time: {} minutes and {} seconds.\n".format(mins, secs))

        # TODO: figure out why bulk_sync doesn't play nice with elasticsearch dsl django auto syncing
        print("Rebuilding search index.")
        management.call_command('search_index', '--rebuild', '-f')
