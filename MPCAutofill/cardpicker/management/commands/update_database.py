import os
import time
from datetime import datetime
from itertools import chain
from math import floor
from pathlib import Path
from typing import Dict, Tuple, Type, Union

import googleapiclient.errors
import imagesize
from django.conf import settings
from django.core import management
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.timezone import make_aware
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from oauth2client.service_account import ServiceAccountCredentials
from tqdm import tqdm

from cardpicker.models import Card, Cardback, Source, SourceType, Token
from cardpicker.utils.to_searchable import to_searchable

# cron job to run this cmd daily: 0 0 * * * bash /root/mpc-autofill/update_database >> /root/db_update.txt 2>&1

# If modifying these scopes, delete the file token.pickle.
SCOPES = [
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

GenericCard = Union[Card, Cardback, Token]

SERVICE_ACC_FILENAME = "client_secrets.json"

DPI_HEIGHT_RATIO = 300 / 1122  # 300 DPI for image of vertical resolution 1122 pixels

# TODO: accept multiple drives as arguments, rather than one or all

# region shared


def calculate_dpi(height: int) -> int:
    return 10 * round(height * DPI_HEIGHT_RATIO / 10)


def do_stuff(
    file_name: str,
    folder_name: str,
    source: Source,
    height: int,
    size: int,
    created_time: datetime,
    drive_id: str = "",
    file_path: str = "",
) -> Tuple[Type[Union[GenericCard]], Union[GenericCard]]:
    # strip the extension off of the item name to retrieve the card name
    try:
        [cardname, extension] = file_name.rsplit(".", 1)
    except ValueError:
        print(f"Issue with parsing image: {file_name}")
        cardname = file_name
        extension = ""

    # TODO: enforce logic of local files having a filepath and no gdrive id, and gdrive files having a gdrive id and no filepath

    card_class = Card
    priority = 2
    if ")" in cardname:
        priority = 1

    source_verbose = source.id

    if "basic" in folder_name.lower():
        priority += 5
        source_verbose = source_verbose + " Basics"

    elif "token" in folder_name.lower():
        card_class = Token
        source_verbose = source_verbose + " Tokens"

    elif "cardbacks" in folder_name.lower() or "card backs" in folder_name.lower():
        card_class = Cardback
        source_verbose = source_verbose + " Cardbacks"

    # Calculate source image DPI, rounded to tens
    dpi = calculate_dpi(int(height))

    return (
        card_class,
        card_class(
            drive_id=drive_id,
            file_path=file_path,
            name=cardname,
            priority=priority,
            source=source,
            source_verbose=source_verbose,
            dpi=dpi,
            searchq=to_searchable(cardname),  # search-friendly card name
            searchq_keyword=to_searchable(cardname),  # for keyword search
            extension=extension,
            date=created_time,
            size=size,
        ),
    )


# region google drive
def locate_drives(service, sources):
    def get_folder_from_id(drive_id, bar: tqdm):
        try:
            folder = service.files().get(fileId=drive_id).execute()
        except googleapiclient.errors.HttpError:
            folder = None

        time.sleep(0.1)
        bar.update(1)
        return folder

    print("Retrieving Google Drive folders...")
    bar = tqdm(total=len(sources))
    folders = {x.id: get_folder_from_id(x.drive_id, bar) for x in sources}
    for x in sources:
        if not folders[x.id]:
            print(f"Failed on drive: {x.id}")
            folders.pop(x.id)
    print("...and done!")
    return folders


def crawl_drive(service, folder):
    # maintain a list of images found in this folder so far, and also maintain a list of
    # unexplored folders in this drive
    unexplored_folders = [folder]
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
    images = []
    while len(unexplored_folders) > 0:
        # explore the first folder in the list - retrieve all images in the folder, add any folders inside it
        # to the unexplored folder list, then remove the current folder from that list, then repeat until all
        # folders have been explored
        time.sleep(0.1)
        curr_folder = unexplored_folders[0]

        indexable = (
            all(x not in curr_folder["name"] for x in ignored_folders)
            and curr_folder["name"][0] != "!"
        )
        if indexable:
            print(f"Searching: {curr_folder['name']}")

            # Store this folder's name in a dict with gdrive ID as keys for tracking parent folder names for cards
            folder_dict[curr_folder["id"]] = curr_folder["name"]

            # Search for folders within the current folder
            while True:
                try:
                    results = (
                        service.files()
                        .list(
                            q="mimeType='application/vnd.google-apps.folder' and "
                            f"'{curr_folder['id']}' in parents",
                            fields="files(id, name, parents)",
                            pageSize=500,
                        )
                        .execute()
                    )
                    unexplored_folders += results.get("files", [])
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
                            f"'{curr_folder['id']}' in parents",
                            fields="nextPageToken, files("
                            "id, name, trashed, size, properties, parents, createdTime, imageMediaMetadata, owners"
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
                    # Store references to current folder name and parent name in each image
                    x["folder_name"] = curr_folder["name"]
                    try:
                        x["parent_name"] = folder_dict[curr_folder["parents"][0]]
                    except KeyError:
                        x["parent_name"] = ""

                images += results.get("files", [])

                page_token = results.get("nextPageToken", None)
                if page_token is None:
                    break

        # once we're finished exploring this folder, remove it from the unexplored folder list
        unexplored_folders.remove(curr_folder)

    return images


def search_folder(service, source, folder):
    print(f"Searching drive: {source.id}")
    card_dict = {Card: [], Cardback: [], Token: []}

    # crawl the drive to retrieve a complete list of images it contains
    images = crawl_drive(service, folder)
    print(f"Number of images found: {len(images)}")

    # add the retrieved cards to the database
    for item in images:
        try:
            # google drive files are valid when it's not trashed and filesize does not exceed 30 MB
            valid = not item["trashed"] and int(item["size"]) < 30000000
            if not valid:
                print(
                    f"Can't index this card: <{item['id']}> {item['name']}, size: {item['size']} bytes"
                )
        except KeyError:
            valid = True

        if valid:
            card_class, card = do_stuff(
                file_name=item["name"],
                folder_name=folder["name"],
                source=source,
                height=int(item["imageMediaMetadata"]["height"]),
                size=item["size"],
                created_time=item["createdTime"],
                drive_id=item["id"],
            )
            card_dict[card_class].append(card)

    print(
        f"\nFinished crawling {folder['name']}.\nSynchronising to database...", end=""
    )
    t0 = time.time()
    for card_class, card_list in card_dict.items():
        with transaction.atomic():
            card_class.objects.filter(source=source).delete()
            card_class.objects.bulk_create(card_list)
    print(f" and done! That took {time.time() - t0} seconds.\n")


def login():
    # authenticate with Google Drive service account JSON credentials
    creds = ServiceAccountCredentials.from_json_keyfile_name(
        SERVICE_ACC_FILENAME, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)


# endregion

# region local files


def crawl_local_folder(
    path: Path,
) -> None:
    """
    create a local file Source for each folder in the given path
    e.g. if path contains `Chilli_Axe's MTG Renders` and `Stuff`, create one source for each, then return a dict
    mapping the Source object to a list of folders associated with that Source (including all sub directories).
    """

    top_level_folders = [x for x in path.iterdir() if x.is_dir()]
    print(
        f"Located {len(top_level_folders)} folders in the local file index - these will be indexed as separate Sources."
    )
    # TODO: primary key uniqueness enforced by file system - but what about between local files and gdrive files?
    for folder in top_level_folders:
        if folder.name[0] != ".":
            print(f"Searching folder: {folder.name}")
            source = Source(
                id=folder.name,
                drive_id="",
                drive_link="",
                source_type=SourceType.LOCAL_FILE,
                description=f"Local file directory at {folder}",
            )
            card_dict = {Card: [], Cardback: [], Token: []}

            image_paths = [
                x for x in chain(folder.rglob("*.png"), folder.rglob("*.jpg"))
            ]  # TODO: more image types?
            print(f"Number of images found: {len(image_paths)}")

            for image_path in image_paths:
                card_class, card = do_stuff(
                    file_name=image_path.name,
                    folder_name=image_path.parent.name,
                    source=source,
                    height=imagesize.get(str(image_path))[1],
                    size=os.path.getsize(str(image_path)),
                    created_time=make_aware(
                        datetime.fromtimestamp(os.path.getctime(str(image_path)))
                    ),
                    file_path=str(image_path),
                )
                card_dict[card_class].append(card)

            print(
                f"\nFinished searching {folder.name}.\nSynchronising to database...",
                end="",
            )
            t0 = time.time()
            with transaction.atomic():
                source.save()
                for card_class, card_list in card_dict.items():
                    card_class.objects.bulk_create(card_list)
            print(f" and done! That took {time.time() - t0} seconds.\n")


# endregion


class Command(BaseCommand):
    # set up help line to print the available drive options
    help = "You may specify one of the following drives: "
    for source in Source.objects.all():
        help += f"{source.id}, "
    help = help[:-2]

    def add_arguments(self, parser):
        parser.add_argument(
            "-d",
            "--drive",
            type=str,
            help="Only update a specific drive",
        )

    def handle(self, *args, **kwargs):
        # user can specify which drive should be searched - if no drive is specified, search all drives
        drive = kwargs["drive"]
        t = time.time()

        management.call_command("import_sources")
        num_gdrive_sources = Source.objects.filter(
            source_type=SourceType.GOOGLE_DRIVE
        ).count()
        if num_gdrive_sources > 0:
            print(
                f"{num_gdrive_sources} Google Drive(/s) sources found in the database."
            )
            service = login()

            # If a valid drive was specified, search only that drive - otherwise, search all drives
            if drive:
                # Try/except to see if the given drive name maps to a Source
                try:
                    source = Source.objects.get(id=drive)
                    folder = locate_drives(service, [source])[source.id]
                    print(f"Rebuilding database for specific drive: {source.id}.")
                    search_folder(service, source, folder)
                except KeyError:
                    print(
                        f"Invalid drive specified: {drive}\nYou may specify one of the following drives:"
                    )
                    [print(x.id) for x in Source.objects.all()]
                    return
            else:
                sources = locate_drives(service, Source.objects.all())
                print("Rebuilding database with all drives.")
                for x in sources:
                    search_folder(service, Source.objects.get(id=x), sources[x])

        if settings.LOCAL_FILE_INDEX:
            print("Local file index path was specified.")
            local_file_index = Path(settings.LOCAL_FILE_INDEX)
            if not local_file_index.exists():
                print("Your local file index path does not exist!")
            else:
                print(f'Repopulating local files index from path "{local_file_index}"')
                Source.objects.filter(
                    source_type=SourceType.LOCAL_FILE
                ).delete()  # associated files deleted from cascade
                crawl_local_folder(local_file_index)

        t0 = time.time()
        print("Rebuilding Elasticsearch indexes...")
        management.call_command("search_index", "--rebuild", "-f")
        print(f"and done! That took {time.time() - t0} seconds.\n")

        t_final = time.time()
        mins = floor((t_final - t) / 60)
        secs = int((t_final - t) - mins * 60)
        print(f"Total elapsed time: {mins} minutes and {secs} seconds.\n")
