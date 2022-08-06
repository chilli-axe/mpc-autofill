import time
from concurrent.futures import ThreadPoolExecutor
from itertools import groupby
from typing import Optional, Type

from cardpicker.models import Card, Cardback, Source, Token
from cardpicker.sources.source_types import Folder, Image, SourceType, SourceTypeChoices
from cardpicker.utils import TEXT_BOLD, TEXT_END
from cardpicker.utils.to_searchable import to_searchable
from django.conf import settings
from django.db import transaction

MAX_WORKERS = 5
DPI_HEIGHT_RATIO = 300 / 1110  # 300 DPI for image of vertical resolution 1110 pixels


def add_images_in_folder_to_list(source_type: Type[SourceType], folder: Folder, image_list: list[Image]) -> None:
    image_list += source_type.get_all_images_inside_folder(folder)


def explore_folder(source: Source, source_type: Type[SourceType], root_folder: Folder) -> list[Image]:
    """
    Explore `folder` and all nested folders to extract all images contained within them.
    """

    t0 = time.time()
    print(f"Locating images for source {TEXT_BOLD}{source.name}{TEXT_END}...", end="")
    image_list: list[Image] = []
    folder_list: list[Folder] = [root_folder]
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        while len(folder_list) > 0:
            folder = folder_list.pop()
            pool.submit(add_images_in_folder_to_list, source_type=source_type, folder=folder, image_list=image_list)
            folder_list += source_type.get_all_folders_inside_folder(folder)
    print(
        f" and done! Located {TEXT_BOLD}{len(image_list):,}{TEXT_END} images "
        f"in {TEXT_BOLD}{(time.time() - t0):.2f}{TEXT_END} seconds."
    )
    return image_list


def transform_images_into_objects(
    source: Source, images: list[Image]
) -> tuple[list[Card], list[Cardback], list[Token]]:
    """
    Transform `images`, which are all associated with `source`, into a set of Django ORM objects ready to be
    synchronised to the database.
    """

    print(f"Generating objects for source {TEXT_BOLD}{source.name}{TEXT_END}...", end="")
    t0 = time.time()

    cards: list[Card] = []
    cardbacks: list[Cardback] = []
    tokens: list[Token] = []

    for image in images:
        # reasons why an image might be invalid
        if int(image.size) > 30_000_000:
            print(f"Can't index this card: <{image.id}> {image.name}, size: {image.size:,} bytes")
            continue
        try:
            name, extension = image.name.rsplit(".", 1)
            if not name or not extension:
                continue
        except ValueError:
            print(f"Issue with parsing image name: {image.name}")
            continue

        dpi = 10 * round(int(image.height) * DPI_HEIGHT_RATIO / 10)
        source_verbose = source.name
        priority = 1 if "(" in name and ")" in name else 2

        folder_location = image.folder.get_full_path()
        if folder_location == settings.DEFAULT_CARDBACK_FOLDER_PATH:
            if name == settings.DFEAULT_CARDBACK_IMAGE_NAME:
                priority += 10
            priority += 5
        if "basic" in image.folder.name.lower():
            priority += 5
            source_verbose += " Basics"

        if "token" in image.folder.name.lower():
            tokens.append(
                Token(
                    identifier=image.id,
                    name=name,
                    priority=priority,
                    source=source,
                    source_verbose=f"{source_verbose} Tokens",
                    folder_location=folder_location,
                    dpi=dpi,
                    searchq=to_searchable(name),  # search-friendly card name
                    searchq_keyword=to_searchable(name),  # for keyword search
                    extension=extension,
                    date=image.created_time,
                    size=image.size,
                )
            )
        elif "cardbacks" in image.folder.name.lower() or "card backs" in image.folder.name.lower():
            cardbacks.append(
                Cardback(
                    identifier=image.id,
                    name=name,
                    priority=priority,
                    source=source,
                    source_verbose=f"{source_verbose} Cardbacks",
                    folder_location=folder_location,
                    dpi=dpi,
                    searchq=to_searchable(name),  # search-friendly card name
                    searchq_keyword=to_searchable(name),  # for keyword search
                    extension=extension,
                    date=image.created_time,
                    size=image.size,
                )
            )
        else:
            cards.append(
                Card(
                    identifier=image.id,
                    name=name,
                    priority=priority,
                    source=source,
                    source_verbose=source_verbose,
                    folder_location=folder_location,
                    dpi=dpi,
                    searchq=to_searchable(name),  # search-friendly card name
                    searchq_keyword=to_searchable(name),  # for keyword search
                    extension=extension,
                    date=image.created_time,
                    size=image.size,
                )
            )
    print(
        f" and done! Generated {TEXT_BOLD}{len(cards):,}{TEXT_END} card/s, {TEXT_BOLD}{len(cardbacks):,}{TEXT_END} "
        f"cardback/s, and {TEXT_BOLD}{len(tokens):,}{TEXT_END} token/s in "
        f"{TEXT_BOLD}{(time.time() - t0):.2f}{TEXT_END} seconds."
    )

    return cards, cardbacks, tokens


def bulk_sync_objects(source: Source, cards: list[Card], cardbacks: list[Cardback], tokens: list[Token]) -> None:
    print(f"Synchronising objects to database for source {TEXT_BOLD}{source.name}{TEXT_END}...", end="")
    t0 = time.time()
    for object_list, model in [(cards, Card), (cardbacks, Cardback), (tokens, Token)]:
        with transaction.atomic():
            model.objects.filter(source=source).delete()
            model.objects.bulk_create(object_list)  # type: ignore
    print(f" and done! That took {TEXT_BOLD}{(time.time() - t0):.2f}{TEXT_END} seconds.")


def update_database_for_source(source: Source, source_type: Type[SourceType], root_folder: Folder) -> None:
    images = explore_folder(source=source, source_type=source_type, root_folder=root_folder)
    cards, cardbacks, tokens = transform_images_into_objects(source=source, images=images)
    bulk_sync_objects(source=source, cards=cards, cardbacks=cardbacks, tokens=tokens)


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
