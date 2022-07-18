import datetime as dt
import time
from dataclasses import dataclass
from math import floor
from typing import Any

import googleapiclient.errors
from cardpicker.models import Card, Cardback, CardBase, Source, Token
from cardpicker.utils.to_searchable import to_searchable
from django.core import management
from django.core.management.base import BaseCommand
from django.db import transaction
from googleapiclient.discovery import Resource, build
from googleapiclient.errors import HttpError
from oauth2client.service_account import ServiceAccountCredentials
from tqdm import tqdm

# cron job to run this cmd daily: 0 0 * * * bash /root/mpc-autofill/update_database >> /root/db_update.txt 2>&1

# If modifying these scopes, delete the file token.pickle.
SCOPES = [
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

SERVICE_ACC_FILENAME = "client_secrets.json"

DPI_HEIGHT_RATIO = 300 / 1110  # 300 DPI for image of vertical resolution 1110 pixels

# TODO: accept multiple drives as arguments, rather than one or all


@dataclass
class Folder:
    id: str
    name: str
    parents: list[str]


@dataclass
class Image:  # TODO: update these Any types
    id: str
    name: str
    size: int
    parent: str
    created_time: dt.datetime
    height: int
    folder: Folder


def locate_drives(service: Resource, sources: list[Source]) -> dict[str, Folder]:
    # TODO: add data classes for things retrieved by google drive api - better typing than dict[str, str]
    def get_folder_from_id(drive_id: str) -> Folder:
        try:
            folder = service.files().get(fileId=drive_id).execute()
        except googleapiclient.errors.HttpError:
            folder = None

        time.sleep(0.1)
        bar.update(1)
        return Folder(id=folder["id"], name=folder["name"], parents=[])

    print("Retrieving Google Drive folders...")
    bar = tqdm(total=len(sources))
    folders = {x.key: get_folder_from_id(x.drive_id) for x in sources}
    for x in sources:
        if not folders[x.key]:
            print(f"Failed on drive: {x.key}")
            folders.pop(x.key)
    print("...and done!")
    return folders


def crawl_drive(service: Resource, folder: Folder) -> list[Image]:
    # maintain a list of images found in this folder so far, and also maintain a list of
    # unexplored folders in this drive
    unexplored_folders: list[Folder] = [folder]
    folder_dict = {}

    # skip any folders with these names
    ignored_folders = [
        "3x5 Size",
        "3.5x5 Size",
        "11. Planechase",
        "[EXTRA] - Card back",
        "[Update 6/5/18] Legendary Walkers",
        "[Update: 6/10/18] Redirect & Misc Errata",
        "Cubes",
        "X. Art & Misc Stuff",
    ]

    # crawl through the drive one folder at a time
    images: list[Image] = []
    while len(unexplored_folders) > 0:
        # explore the first folder in the list - retrieve all images in the folder, add any folders inside it
        # to the unexplored folder list, then remove the current folder from that list, then repeat until all
        # folders have been explored
        time.sleep(0.1)
        curr_folder = unexplored_folders[0]

        # Skip some folders as specified
        acceptable = all(x not in curr_folder.name for x in ignored_folders) and curr_folder.name[0] != "!"
        if acceptable:
            print(f"Searching: {curr_folder.name}")

            # Store this folder's name in a dict with gdrive ID as keys for tracking parent folder names for cards
            folder_dict[curr_folder.id] = curr_folder.name

            # Search for folders within the current folder
            while True:
                try:
                    results = (
                        service.files()
                        .list(
                            q="mimeType='application/vnd.google-apps.folder' and " f"'{curr_folder.id}' in parents",
                            fields="files(id, name, parents)",
                            pageSize=500,
                        )
                        .execute()
                    )
                    unexplored_folders += [
                        Folder(id=x["id"], name=x["name"], parents=x["parents"]) for x in results.get("files", [])
                    ]
                    break
                except HttpError:
                    pass

            # Search for images with paging - probably not necessary for folders
            page_token = None
            while True:
                # Search for all images within this folder
                time.sleep(0.1)
                try:
                    results = (
                        service.files()
                        .list(
                            q="(mimeType contains 'image/png' or "
                            "mimeType contains 'image/jpg' or "
                            "mimeType contains 'image/jpeg') and "
                            f"'{curr_folder.id}' in parents",
                            fields="nextPageToken, files("
                            "id, name, trashed, size, parents, createdTime, imageMediaMetadata"
                            ")",
                            pageSize=500,
                            pageToken=page_token,
                        )
                        .execute()
                    )
                except HttpError:
                    # TODO: Not pass?
                    pass

                if len(results["files"]) <= 0:
                    break

                print(f"Found {len(results.get('files', []))} image(s)")

                # Append the retrieved images to the image list
                located_images = results.get("files", [])
                for x in located_images:
                    if not x["trashed"]:
                        try:
                            parent = folder_dict[curr_folder.parents[0]]
                        except KeyError:
                            parent = ""
                        images.append(
                            Image(
                                id=x["id"],
                                name=x["name"],
                                created_time=x["createdTime"],
                                folder=curr_folder,
                                height=x["imageMediaMetadata"]["height"],
                                parent=parent,
                                size=x["size"],
                            )
                        )

                page_token = results.get("nextPageToken", None)
                if page_token is None:
                    break

        # once we're finished exploring this folder, remove it from the unexplored folder list
        unexplored_folders.remove(curr_folder)

    return images


def search_folder(service: Resource, source: Source, folder: Folder) -> None:
    # TODO: this code is horrendously unclear with its variable scope and needs to be rewritten.
    print(f"Searching drive: {source.key}")

    # maintain list of cards, cardbacks, and tokens found for this Source
    q_cards: list[Card] = []
    q_cardbacks: list[Cardback] = []
    q_tokens: list[Token] = []

    # crawl the drive to retrieve a complete list of images it contains
    images = crawl_drive(service, folder)
    print(f"Number of images found: {len(images)}")

    # add the retrieved cards to the database
    for x in images:
        add_card(folder=folder, source=source, item=x, q_cards=q_cards, q_cardbacks=q_cardbacks, q_tokens=q_tokens)

    print(f"\nFinished crawling {folder.name}.\nSynchronising to database...", end="")

    t0 = time.time()

    # Synchronise q_cards with Cards, q_cardbacks with Cardbacks, and q_tokens with Tokens
    queue_object_map = [(q_cardbacks, Cardback), (q_tokens, Token), (q_cards, Card)]

    # django-bulk-sync is kinda super broken and this is way better
    for queue, model in queue_object_map:
        with transaction.atomic():
            model.objects.filter(source=source).delete()
            model.objects.bulk_create(queue)  # type: ignore  # TODO: proper typing here

    print(f" and done! That took {time.time() - t0} seconds.\n")


def add_card(
    folder: Folder, source: Source, item: Image, q_cards: list[Card], q_cardbacks: list[Cardback], q_tokens: list[Token]
) -> None:
    # file is valid when it's not trashed and filesize does not exceed 30 MB
    if int(item.size) > 30_000_000:
        print(f"Can't index this card: <{item.id}> {item.name}, size: {item.size} bytes")
        return

    # strip the extension off of the item name to retrieve the card name
    try:
        cardname, extension = item.name.rsplit(".", 1)
    except ValueError:
        print(f"Issue with parsing image: {item.name}")
        return

    img_type = "card"
    folder_name = item.folder.name

    # Skip this file if it doesn't have a name after splitting name & extension
    if not cardname:
        return

    priority = 2
    source_verbose = str(source.key)

    if ")" in cardname:
        priority = 1

    if folder.name == "Chilli_Axe's MPC Proxies":
        if folder_name == "12. Cardbacks":
            if "Black Lotus" in item.name:
                priority += 10
            img_type = "cardback"
            priority += 5
    elif folder.name == "nofacej MPC Card Backs":
        img_type = "cardback"

    if "basic" in folder_name.lower():
        priority += 5
        source_verbose = source_verbose + " Basics"
    elif "token" in folder_name.lower():
        img_type = "token"
    elif "cardbacks" in folder_name.lower() or "card backs" in folder_name.lower():
        img_type = "cardback"
        source_verbose = source_verbose + " Cardbacks"

    # Calculate source image DPI, rounded to tens
    dpi = 10 * round(int(item.height) * DPI_HEIGHT_RATIO / 10)

    # Use a dictionary to map the img type to the queue and class of card we need to append/create
    queue_object_map = {"cardback": (q_cardbacks, Cardback), "token": (q_tokens, Token), "card": (q_cards, Card)}

    queue: list[CardBase] = queue_object_map[img_type][0]  # type: ignore
    queue.append(
        queue_object_map[img_type][1](
            drive_id=item.id,
            name=cardname,
            priority=priority,
            source=source,
            source_verbose=source_verbose,
            dpi=dpi,
            searchq=to_searchable(cardname),  # search-friendly card name
            searchq_keyword=to_searchable(cardname),  # for keyword search
            extension=extension,
            date=item.created_time,
            size=item.size,
        )
    )


def login() -> Resource:
    # authenticate with Google Drive service account JSON credentials
    creds = ServiceAccountCredentials.from_json_keyfile_name(SERVICE_ACC_FILENAME, scopes=SCOPES)
    return build("drive", "v3", credentials=creds)


class Command(BaseCommand):
    # set up help line to print the available drive options
    help = "You may specify one of the following drives: " + ", ".join(Source.objects.values_list("key", flat=True))

    def add_arguments(self, parser) -> None:  # type: ignore
        parser.add_argument("-d", "--drive", type=str, help="Only update a specific drive")

    def handle(self, *args: Any, **kwargs: dict[str, Any]) -> None:
        # user can specify which drive should be searched - if no drive is specified, search all drives
        drive = kwargs["drive"]

        service = login()
        t = time.time()

        # If a valid drive was specified, search only that drive - otherwise, search all drives
        if drive:
            # Try/except to see if the given drive name maps to a Source
            try:
                source = Source.objects.get(key=drive)
                folder = locate_drives(service, [source])[source.key]
                print(f"Rebuilding database for specific drive: {source.key}.")
                search_folder(service, source, folder)
            except KeyError:
                print(f"Invalid drive specified: {drive}\nYou may specify one of the following drives:")
                [print(x.key) for x in Source.objects.all()]
                return
        else:
            sources = locate_drives(service, list(Source.objects.all()))
            print("Rebuilding database with all drives.")
            for x in sources:
                search_folder(service, Source.objects.get(key=x), sources[x])

        t0 = time.time()
        print("Rebuilding Elasticsearch indexes...")
        management.call_command("search_index", "--rebuild", "-f")
        print(f"and done! That took {time.time() - t0} seconds.\n")

        t_final = time.time()
        mins = floor((t_final - t) / 60)
        secs = int((t_final - t) - mins * 60)
        print(f"Total elapsed time: {mins} minutes and {secs} seconds.\n")
