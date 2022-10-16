import json
import time
from concurrent.futures import ThreadPoolExecutor
from itertools import groupby
from typing import Optional, Type

from bulk_sync import bulk_sync

from django.conf import settings
from django.db.models import Q

from cardpicker.constants import MAX_SIZE_MB
from cardpicker.models import Card, CardTypes, Source
from cardpicker.sources.source_types import Folder, Image, SourceType, SourceTypeChoices
from cardpicker.tags import Tag
from cardpicker.utils import TEXT_BOLD, TEXT_END
from cardpicker.utils.sanitisation import to_searchable

MAX_WORKERS = 5
DPI_HEIGHT_RATIO = 300 / 1110  # 300 DPI for image of vertical resolution 1110 pixels


def add_images_in_folder_to_list(source_type: Type[SourceType], folder: Folder, image_list: list[Image]) -> None:
    image_list += source_type.get_all_images_inside_folder(folder)


def explore_folder(source: Source, source_type: Type[SourceType], root_folder: Folder) -> list[Image]:
    """
    Explore `folder` and all nested folders to extract all images contained within them.
    """

    t0 = time.time()
    print(f"Locating images for source {TEXT_BOLD}{source.name}{TEXT_END}...", end="", flush=True)
    image_list: list[Image] = []
    folder_list: list[Folder] = [root_folder]
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        while len(folder_list) > 0:
            folder = folder_list.pop()
            pool.submit(add_images_in_folder_to_list, source_type=source_type, folder=folder, image_list=image_list)
            sub_folders = source_type.get_all_folders_inside_folder(folder)
            folder_list += list(filter(lambda x: not x.name.startswith("!"), sub_folders))
    print(
        f" and done! Located {TEXT_BOLD}{len(image_list):,}{TEXT_END} images "
        f"in {TEXT_BOLD}{(time.time() - t0):.2f}{TEXT_END} seconds."
    )
    return image_list


def transform_images_into_objects(source: Source, images: list[Image]) -> list[Card]:
    """
    Transform `images`, which are all associated with `source`, into a set of Django ORM objects ready to be
    synchronised to the database.
    """

    print(f"Generating objects for source {TEXT_BOLD}{source.name}{TEXT_END}...", end="", flush=True)
    t0 = time.time()

    cards: list[Card] = []
    card_count = 0
    cardback_count = 0
    token_count = 0

    for image in images:
        try:
            # reasons why an image might be invalid
            assert image.size <= (
                MAX_SIZE_MB * 1_000_000
            ), f"Image size is greater than {MAX_SIZE_MB} MB at **{int(image.size / 1_000_000)}** MB"
            assert image.name, "File name is empty string"
            assert "." in image.name[:-1], "File name has no extension"
            name, extension = image.name.rsplit(".", 1)
            assert bool(searchable_name := to_searchable(name)), "Searchable file name is empty string"
            tag_list = Tag.list_from_card_name(name)
            tags = ""
            if len(tag_list) > 0:
                tags = json.dumps(tag_list)

            dpi = 10 * round(int(image.height) * DPI_HEIGHT_RATIO / 10)
            source_verbose = source.name
            priority = 1 if "(" in name and ")" in name else 2

            folder_location = image.folder.get_full_path()
            if folder_location == settings.DEFAULT_CARDBACK_FOLDER_PATH:
                if name == settings.DEFAULT_CARDBACK_IMAGE_NAME:
                    priority += 10
                priority += 5
            if "basic" in image.folder.name.lower():
                priority += 5
                source_verbose += " Basics"

            card_type = CardTypes.CARD
            if "token" in image.folder.name.lower():
                card_type = CardTypes.TOKEN
                source_verbose = f"{source_verbose} Tokens"
                token_count += 1
            elif "cardbacks" in image.folder.name.lower() or "card backs" in image.folder.name.lower():
                card_type = CardTypes.CARDBACK
                source_verbose = f"{source_verbose} Cardbacks"
                cardback_count += 1
            else:
                card_count += 1

            cards.append(
                Card(
                    identifier=image.id,
                    card_type=card_type,
                    name=name,
                    priority=priority,
                    source=source,
                    source_verbose=source_verbose,
                    folder_location=folder_location,
                    dpi=dpi,
                    searchq=searchable_name,  # search-friendly card name
                    searchq_keyword=searchable_name,  # for keyword search
                    extension=extension,
                    date=image.created_time,
                    size=image.size,
                    tags=tags,
                )
            )
        except AssertionError as e:
            print(f"Skipping image **{image.name}** (identifier **{image.id}**) for the following reason: **{e}**")
    print(
        f" and done! Generated {TEXT_BOLD}{card_count:,}{TEXT_END} card/s, {TEXT_BOLD}{cardback_count:,}{TEXT_END} "
        f"cardback/s, and {TEXT_BOLD}{token_count:,}{TEXT_END} token/s in "
        f"{TEXT_BOLD}{(time.time() - t0):.2f}{TEXT_END} seconds."
    )

    return cards


def bulk_sync_objects(source: Source, cards: list[Card]) -> None:
    print(f"Synchronising objects to database for source {TEXT_BOLD}{source.name}{TEXT_END}...", end="", flush=True)
    key_fields = ("identifier",)
    t0 = time.time()
    bulk_sync(new_models=cards, key_fields=key_fields, filters=Q(source_id=source.pk), db_class=Card)
    print(f" and done! That took {TEXT_BOLD}{(time.time() - t0):.2f}{TEXT_END} seconds.")


def update_database_for_source(source: Source, source_type: Type[SourceType], root_folder: Folder) -> None:
    images = explore_folder(source=source, source_type=source_type, root_folder=root_folder)
    cards = transform_images_into_objects(source=source, images=images)
    bulk_sync_objects(source=source, cards=cards)


def update_database(source_key: Optional[str] = None) -> None:
    """
    Update the contents of the database against the configured sources.
    If `source_key` is specified, only update that source; otherwise, update all sources.
    """

    if source_key:
        try:
            source = Source.objects.get(key=source_key)
            source_type = SourceTypeChoices.get_source_type(SourceTypeChoices[source.source_type])
            if (root_folder := source_type.get_all_folders([source])[source.key]) is not None:
                update_database_for_source(source=source, source_type=source_type, root_folder=root_folder)
        except Source.DoesNotExist:
            print(
                f"Invalid source specified: {TEXT_BOLD}{source_key}{TEXT_END}"
                f"\nYou may specify one of the following sources: "
                f"{', '.join([f'{TEXT_BOLD}{x.key}{TEXT_END}' for x in Source.objects.all()])}"
            )
            exit(-1)
    else:
        print("Updating the database for all sources.")
        sources = sorted(Source.objects.all(), key=lambda x: x.source_type)
        for source_type_name, grouped_sources_iterable in groupby(sources, lambda x: x.source_type):
            grouped_sources = list(grouped_sources_iterable)
            source_type = SourceTypeChoices.get_source_type(SourceTypeChoices[source_type_name])
            folders = source_type.get_all_folders(grouped_sources)
            print(
                f"Identified the following sources of type "
                f"{TEXT_BOLD}{SourceTypeChoices[source_type_name].label}{TEXT_END}: "
                f"{', '.join([f'{TEXT_BOLD}{x.name}{TEXT_END}' for x in grouped_sources])}\n"
            )
            for grouped_source in grouped_sources:
                if (root_folder := folders[grouped_source.key]) is not None:
                    update_database_for_source(source=grouped_source, source_type=source_type, root_folder=root_folder)
                    print("")
