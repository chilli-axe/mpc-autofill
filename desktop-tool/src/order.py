import hashlib
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from functools import reduce
from glob import glob
from itertools import groupby
from pathlib import Path
from queue import Queue
from typing import Optional, cast
from xml.etree.ElementTree import Element, ParseError

import attr
import enlighten
from defusedxml.ElementTree import parse as defused_parse
from InquirerPy import prompt
from sanitize_filename import sanitize

from src import constants
from src.constants import PROJECT_MAX_SIZE
from src.exc import ValidationException
from src.formatting import bold, text_to_set
from src.io import (
    download_google_drive_file,
    file_exists,
    get_google_drive_file_name,
    get_image_directory,
)
from src.logging import logger
from src.processing import ImagePostProcessingConfig
from src.utils import unpack_element


@attr.s
class CardImage:
    drive_id: str = attr.ib(default="")
    slots: set[int] = attr.ib(factory=set)
    name: Optional[str] = attr.ib(default="")
    file_path: Optional[str] = attr.ib(default="")
    query: Optional[str] = attr.ib(default=None)

    pid: Optional[str] = attr.ib(default=None)

    downloaded: bool = attr.ib(init=False, default=False)
    uploaded: bool = attr.ib(init=False, default=False)
    errored: bool = attr.ib(init=False, default=False)

    # region file system interactions

    def file_exists(self) -> bool:
        """
        Determines whether this image has been downloaded successfully.
        """

        return file_exists(self.file_path)

    def retrieve_card_name(self) -> None:
        """
        Retrieves the file's name based on Google Drive ID. `None` indicates that the file on GDrive is invalid.
        """

        if not self.name:
            self.name = get_google_drive_file_name(drive_id=self.drive_id)

    def generate_file_path(self, working_directory: str) -> None:
        """
        Sets `self.file_path` according to the following logic:
        * If `self.drive_id` points to a valid file in the user's file system, use it as the file path
        * If a file with `self.name` exists in the `cards` directory, use the path to that file as the file path
        * Otherwise, use `self.name` with `self.drive_id` in parentheses in the `cards` directory as the file path.
        """

        if self.file_path:
            return

        image_directory = get_image_directory(working_directory=working_directory)

        if file_exists(self.drive_id):
            self.file_path = self.drive_id
            self.name = os.path.basename(self.file_path)
            return

        if not self.name:
            self.retrieve_card_name()

        if self.name is None:
            if self.drive_id:
                # assume png
                logger.info(
                    f"The name of the image {bold(self.drive_id)} could not be determined, meaning that its "
                    f"file extension is unknown. As a result, an assumption is made that the file extension "
                    f"is {bold('.png')}."
                )
                self.name = f"{self.drive_id}.png"
                self.file_path = os.path.join(image_directory, sanitize(self.name))
            else:
                self.file_path = None
        else:
            file_path = os.path.join(image_directory, sanitize(self.name))
            if not os.path.isfile(file_path) or os.path.getsize(file_path) <= 0:
                # The filepath without ID in parentheses doesn't exist - change the filepath to contain the ID instead
                name_split = self.name.rsplit(".", 1)
                file_path = os.path.join(
                    image_directory, sanitize(f"{name_split[0]} ({self.drive_id}).{name_split[1]}")
                )
            self.file_path = file_path

        self.validate()

    def generate_pid(self) -> None:
        """
        The MakePlayingCards frontend uses SHA-1 for computing image PIDs (which are treated as image's unique IDs
        in their system's logic).
        """

        if self.pid or (not self.file_exists()):
            return

        with open(cast(str, self.file_path), "rb") as f:
            self.pid = hashlib.sha1(f.read()).hexdigest().upper()

    # endregion

    # region initialisation

    def validate(self) -> None:
        self.errored = any([self.errored, self.name is None, self.file_path is None])

    # endregion

    # region public

    def combine(self, other: "CardImage") -> "CardImage":
        assert self.drive_id == other.drive_id
        return CardImage(
            drive_id=self.drive_id,
            slots=self.slots | other.slots,
            name=self.name,
            file_path=self.file_path,
            query=self.query,
        )

    @classmethod
    def from_element(cls, element: Element, working_directory: str) -> "CardImage":
        card_dict = unpack_element(element, [x.value for x in constants.DetailsTags])
        drive_id = ""
        if (drive_id_text := card_dict[constants.CardTags.id].text) is not None:
            drive_id = drive_id_text.strip(' "')
        slots: set[int] = set()
        if (slots_text := card_dict[constants.CardTags.slots].text) is not None:
            slots = text_to_set(slots_text)
        name = None
        if constants.CardTags.name in card_dict.keys():
            name = card_dict[constants.CardTags.name].text
        query = None
        if constants.CardTags.query in card_dict.keys():
            query = card_dict[constants.CardTags.query].text
        card_image = cls(drive_id=drive_id, slots=slots, name=name, query=query)
        card_image.generate_file_path(working_directory=working_directory)
        card_image.validate()
        return card_image

    def download_image(
        self,
        queue: Queue[tuple[str, bool]],
        download_bar: enlighten.Counter,
        post_processing_config: Optional[ImagePostProcessingConfig],
    ) -> None:
        try:
            if not self.file_exists() and not self.errored and self.file_path is not None:
                self.errored = not download_google_drive_file(
                    drive_id=self.drive_id, file_path=self.file_path, post_processing_config=post_processing_config
                )

            if self.file_exists() and not self.errored:
                self.downloaded = True
            else:
                logger.info(
                    f"Failed to download '{bold(self.name)}' - allocated to slot/s {bold(sorted(self.slots))}.\n"
                    f"Download link - {bold(f'https://drive.google.com/uc?id={self.drive_id}&export=download')}\n"
                )
        except Exception as e:
            # note: python threads die silently if they encounter an exception. if an exception does occur,
            # log it, but still put the card onto the queue so the main thread doesn't spin its wheels forever waiting.
            logger.info(
                f"An uncaught exception occurred when attempting to download '{bold(self.name)}':\n{bold(e)}\n"
                f"Download link - {bold(f'https://drive.google.com/uc?id={self.drive_id}&export=download')}\n"
            )
        finally:
            queue.put((self.drive_id, self.downloaded))
            download_bar.update()
            download_bar.refresh()

    def offset_slots(self, offset: int) -> "CardImage":
        return CardImage(
            drive_id=self.drive_id,
            slots={slot + offset for slot in self.slots},
            name=self.name,
            file_path=self.file_path,
            query=self.query,
        )

    def truncate(self) -> "CardImage":
        return CardImage(
            drive_id=self.drive_id,
            slots={slot for slot in self.slots if slot < PROJECT_MAX_SIZE},
            name=self.name,
            file_path=self.file_path,
            query=self.query,
        )

    def split(self, splits: list[int]) -> list[Optional["CardImage"]]:
        if not splits:
            return [self]
        split_cards: list[Optional["CardImage"]] = [None] * len(splits)
        splits_with_ends = [0, *splits]
        for i in range(0, len(splits_with_ends[:-1])):
            slots_in_split = {
                slot - splits_with_ends[i]
                for slot in self.slots
                if splits_with_ends[i] <= slot < splits_with_ends[i + 1]
            }
            if slots_in_split:
                split_cards[i] = CardImage(
                    drive_id=self.drive_id,
                    slots=slots_in_split,
                    name=self.name,
                    file_path=self.file_path,
                    query=self.query,
                )
        return split_cards

    # endregion


@attr.s
class CardImageCollection:
    """
    A collection of CardImages for one face of a CardOrder.
    """

    cards_by_id: dict[str, CardImage] = attr.ib(factory=dict)  # keyed by ID
    queue: Queue[tuple[str, bool]] = attr.ib(default=attr.Factory(Queue))
    num_slots: int = attr.ib(default=0)
    face: constants.Faces = attr.ib(default=constants.Faces.front)

    def append(self, card: CardImage) -> None:
        if card.drive_id in self.cards_by_id.keys():
            self.cards_by_id[card.drive_id] = self.cards_by_id[card.drive_id].combine(card)
        else:
            self.cards_by_id[card.drive_id] = card

    def combine(self, other: "CardImageCollection") -> "CardImageCollection":
        assert self.face == other.face
        return CardImageCollection(
            cards_by_id=self.cards_by_id
            | {
                drive_id: (
                    card.offset_slots(self.num_slots).combine(self.cards_by_id[drive_id])
                    if drive_id in self.cards_by_id.keys()
                    else card.offset_slots(self.num_slots)
                )
                for drive_id, card in other.cards_by_id.items()
            },
            num_slots=self.num_slots + other.num_slots,
            face=self.face,
        )

    def offset_slots(self, offset: int) -> "CardImageCollection":
        return CardImageCollection(
            cards_by_id={drive_id: card.offset_slots(offset=offset) for drive_id, card in self.cards_by_id.items()},
            num_slots=self.num_slots + offset,
            face=self.face,
            queue=self.queue,
        )

    def truncate(self) -> "CardImageCollection":
        return CardImageCollection(
            cards_by_id={drive_id: card.truncate() for drive_id, card in self.cards_by_id.items()},
            num_slots=self.num_slots,
            face=self.face,
            queue=self.queue,
        )

    # region initialisation

    def all_slots(self) -> set[int]:
        return set(range(0, self.num_slots))

    def slots(self) -> set[int]:
        return {slot for card in self.cards_by_id.values() for slot in card.slots}

    def validate(self) -> None:
        if self.num_slots == 0 or not self.cards_by_id:
            raise ValidationException(f"{self.face} has no images!")
        slots_missing = self.all_slots() - self.slots()
        if slots_missing:
            logger.info(
                f"Warning - the following slots are empty in your order for the {self.face} face: "
                f"{bold(sorted(slots_missing))}"
            )

    # endregion

    # region public

    @classmethod
    def from_element(
        cls,
        element: Element,
        working_directory: str,
        num_slots: int,
        face: constants.Faces,
        fill_image_id: Optional[str] = None,
    ) -> "CardImageCollection":
        card_images: dict[str, CardImage] = {}
        if element:
            for x in element:
                card_image = CardImage.from_element(element=x, working_directory=working_directory)
                if card_image.drive_id in card_images.keys():
                    card_images[card_image.drive_id] = card_images[card_image.drive_id].combine(card_image)
                else:
                    card_images[card_image.drive_id] = card_image
        card_image_collection = cls(cards_by_id=card_images, num_slots=num_slots, face=face)
        if fill_image_id:
            # fill the remaining slots in this card image collection with a new card image based off the given id
            missing_slots = card_image_collection.all_slots() - card_image_collection.slots()
            if missing_slots:
                fill_image = CardImage(drive_id=fill_image_id.strip(' "'), slots=missing_slots)
                fill_image.generate_file_path(working_directory=working_directory)
                card_image_collection.append(fill_image)

        # postponing validation from post-init so we don't error for missing slots that `fill_image_id` would fill
        card_image_collection.validate()
        return card_image_collection

    def download_images(
        self,
        pool: ThreadPoolExecutor,
        download_bar: enlighten.Counter,
        post_processing_config: Optional[ImagePostProcessingConfig],
    ) -> None:
        """
        Set up the provided ThreadPoolExecutor to download this collection's images, updating the given progress
        bar with each image. Async function.
        """

        pool.map(
            lambda x: x.download_image(self.queue, download_bar, post_processing_config), self.cards_by_id.values()
        )

    # endregion


@attr.s(frozen=True)  # freezing so these can be hashed
class Details:
    quantity: int = attr.ib(default=0)
    stock: str = attr.ib(default=constants.Cardstocks.S30.value)
    foil: bool = attr.ib(default=False)
    allowed_to_exceed_project_max_size: bool = attr.ib(default=False)

    # region initialisation

    def validate(self) -> None:
        if (not self.allowed_to_exceed_project_max_size) and self.quantity > constants.PROJECT_MAX_SIZE:
            raise ValidationException(
                f"Order quantity {self.quantity} larger than maximum size of {bold(constants.PROJECT_MAX_SIZE)}!"
            )
        if self.stock not in [x.value for x in constants.Cardstocks]:
            raise ValidationException(f"Order cardstock {self.stock} not supported!")
        if self.stock == constants.Cardstocks.P10 and self.foil is True:
            raise ValidationException(f"Order cardstock {self.stock} is not supported in foil!")

    # endregion

    # region public

    @classmethod
    def from_element(cls, element: Element, allowed_to_exceed_project_max_size: bool) -> "Details":
        details_dict = unpack_element(element, [x.value for x in constants.DetailsTags])
        quantity = 0
        if (quantity_text := details_dict[constants.DetailsTags.quantity].text) is not None:
            quantity = int(quantity_text)
        stock = details_dict[constants.DetailsTags.stock].text or constants.Cardstocks.S30
        foil: bool = details_dict[constants.DetailsTags.foil].text == "true"

        details = cls(
            quantity=quantity,
            stock=stock,
            foil=foil,
            allowed_to_exceed_project_max_size=allowed_to_exceed_project_max_size,
        )
        details.validate()
        return details

    # endregion


@attr.s
class CardOrder:
    name: Optional[str] = attr.ib(default=None)
    details: Details = attr.ib(default=None)
    fronts: CardImageCollection = attr.ib(default=None)
    backs: CardImageCollection = attr.ib(default=None)

    def offset_slots(self, offset: int, allowed_to_exceed_project_max_size: bool) -> "CardOrder":
        return CardOrder(
            name=self.name,
            details=Details(
                quantity=min(self.details.quantity + offset, PROJECT_MAX_SIZE),
                stock=self.details.stock,
                foil=self.details.foil,
                allowed_to_exceed_project_max_size=allowed_to_exceed_project_max_size,
            ),
            fronts=self.fronts.offset_slots(offset=offset),
            backs=self.backs.offset_slots(offset=offset),
        )

    def truncate(self) -> "CardOrder":
        return CardOrder(
            name=self.name,
            details=Details(
                quantity=min(self.details.quantity, PROJECT_MAX_SIZE),
                stock=self.details.stock,
                foil=self.details.foil,
                allowed_to_exceed_project_max_size=False,
            ),
            fronts=self.fronts.truncate(),
            backs=self.backs.truncate(),
        )

    def is_combinable(self, other: "CardOrder") -> bool:
        return self.details.foil == other.details.foil and self.details.stock == other.details.stock

    def combine(self, other: "CardOrder") -> "CardOrder":
        """
        Combine `self` and `other` into a new `CardOrder`.
        Orders must be "compatible" in order to be combined - i.e. they must share the same finish configuration.
        Where both orders have the same single cardback, we continue to treat the cardback as a singleton
        because this enables a large time saving optimisation when auto-filling the order into MakePlayingCards.
        """

        # users should never hit this assertion because we group by details before combining
        assert self.is_combinable(other=other)
        return CardOrder(
            name=f"Combined {self.details.stock} ({'foil' if self.details.foil else 'nonfoil'})",
            # assume that stock and foil finish are identical because the two orders are combinable
            details=Details(
                foil=self.details.foil,
                stock=self.details.stock,
                quantity=self.details.quantity + other.details.quantity,
                allowed_to_exceed_project_max_size=True,
            ),
            fronts=self.fronts.combine(other.fronts),
            backs=self.backs.combine(other.backs),
        )

    def get_project_sizes(self) -> list[int]:
        naive_split = f"Split every {constants.PROJECT_MAX_SIZE} cards"
        interactive_split = "Let me specify how to split the cards"
        questions = {
            "type": "list",
            "name": "split_choices",
            "message": (
                f"Your project/s with cardstock {self.details.stock} ({'' if self.details.foil else 'non-'}foil)\n"
                f"contain {self.details.quantity} cards, which exceeds the maximum project size of "
                f"{constants.PROJECT_MAX_SIZE}.\n"
                f"How should the project/s be split to fit within {constants.PROJECT_MAX_SIZE} cards at most?"
            ),
            "choices": [naive_split, interactive_split],
        }
        answers = prompt(questions)
        split_method = answers["split_choices"]

        # assume naive split
        remainder = self.details.quantity % constants.PROJECT_MAX_SIZE
        project_sizes = [constants.PROJECT_MAX_SIZE] * (
            (self.details.quantity - remainder) // constants.PROJECT_MAX_SIZE
        )
        if remainder:
            project_sizes.append(remainder)

        if split_method == interactive_split:
            # ask user to specify their desired splits
            while True:
                splits_text = input(
                    f"Enter a comma-separated list of project sizes (each up to {bold(constants.PROJECT_MAX_SIZE)}) "
                    f"that sum to {bold(self.details.quantity)} and press {bold('Enter')}. "
                )
                try:
                    project_sizes = [int(split_text) for split_text in splits_text.replace(" ", "").split(",")]
                    for raw_split in project_sizes:
                        assert 0 < raw_split <= constants.PROJECT_MAX_SIZE
                    assert sum(project_sizes) == self.details.quantity
                    break
                except (ValueError, AssertionError):
                    logger.info(
                        f"There was a problem with your proposed splits (perhaps they didn't sum to "
                        f"{bold(self.details.quantity)}); please try again."
                    )
                    pass
        logger.info(
            f"The tool will produce {bold(len(project_sizes))} projects! They'll be sized as follows:\n"
            f"{', '.join(['Project ' + bold(i) + ': ' + bold(project_size) + ' cards' for i, project_size in enumerate(project_sizes, start=1)])}"
        )
        return project_sizes

    def split(self) -> list["CardOrder"]:
        """
        Split `self` into multiple orders which each meet the PROJECT_MAX_SIZE upper size bound constraint.
        """

        if self.details.quantity <= constants.PROJECT_MAX_SIZE:
            return [self]

        raw_splits = self.get_project_sizes()

        # create the split orders
        split_orders = [
            CardOrder(
                details=Details(
                    quantity=raw_split,
                    stock=self.details.stock,
                    foil=self.details.foil,
                    allowed_to_exceed_project_max_size=False,
                ),
                fronts=CardImageCollection(num_slots=raw_split, face=constants.Faces.front),
                backs=CardImageCollection(num_slots=raw_split, face=constants.Faces.back),
            )
            for raw_split in raw_splits
        ]

        # this translates splits like [100, 150, 100] into splits like [100, 250, 350]
        splits = [sum(raw_splits[: i + 1]) for i in range(len(raw_splits))]

        # split each card and assign them to their corresponding order
        for front_card in self.fronts.cards_by_id.values():
            split_cards = front_card.split(splits)
            for i, split_card in enumerate(split_cards):
                if split_card:
                    split_orders[i].fronts.append(split_card)
        for back_card in self.backs.cards_by_id.values():
            split_cards = back_card.split(splits)
            for i, split_card in enumerate(split_cards):
                if split_card:
                    split_orders[i].backs.append(split_card)

        return split_orders

    # region initialisation

    def validate(self) -> None:
        for collection in [self.fronts, self.backs]:
            for image in collection.cards_by_id.values():
                if not image.file_path:
                    raise ValidationException(
                        f"The file path for the image in slots {bold(sorted(image.slots) or image.drive_id)} "
                        f"of face {bold(collection.face)} could not be determined."
                    )

    @classmethod
    def from_element(
        cls,
        element: Element,
        working_directory: str,
        allowed_to_exceed_project_max_size: bool,
        name: Optional[str] = None,
    ) -> "CardOrder":
        root_dict = unpack_element(element, [x.value for x in constants.BaseTags])
        details = Details.from_element(
            element=root_dict[constants.BaseTags.details],
            allowed_to_exceed_project_max_size=allowed_to_exceed_project_max_size,
        )
        fronts = CardImageCollection.from_element(
            element=root_dict[constants.BaseTags.fronts],
            working_directory=working_directory,
            num_slots=details.quantity,
            face=constants.Faces.front,
        )
        cardback_elem = root_dict[constants.BaseTags.cardback]
        if cardback_elem.text is not None:
            backs = CardImageCollection.from_element(
                element=root_dict[constants.BaseTags.backs],
                working_directory=working_directory,
                num_slots=details.quantity,
                face=constants.Faces.back,
                fill_image_id=cardback_elem.text,
            )
        else:
            logger.info(f"{bold('Warning')}: Your order file did not contain a common cardback image.")
            backs = CardImageCollection.from_element(
                element=root_dict[constants.BaseTags.backs],
                working_directory=working_directory,
                num_slots=details.quantity,
                face=constants.Faces.back,
            )
        order = cls(name=name, details=details, fronts=fronts, backs=backs)
        order.validate()
        return order

    @classmethod
    def from_file_path(cls, working_directory: str, file_path: str) -> "CardOrder":
        try:
            xml = defused_parse(file_path)
        except ParseError:
            raise ValidationException(
                "Your XML file contains a syntax error so it can't be processed. Press Enter to exit."
            )
        file_name = Path(file_path).stem
        logger.info(f"Parsing XML file {bold(file_name)}...")
        order = cls.from_element(
            element=xml.getroot(),
            working_directory=working_directory,
            name=file_name,
            allowed_to_exceed_project_max_size=True,
        )
        return order

    # endregion

    # region public

    @classmethod
    def from_xmls_in_folder(cls, working_directory: str) -> list["CardOrder"]:
        """
        Reads some number of XMLs from the current directory, offering a choice if multiple are detected,
        and populates them with the contents of the selected files.
        The primary public entry point to this class.
        """

        xml_glob = sorted(glob(os.path.join(working_directory, "*.xml")))
        if len(xml_glob) <= 0:
            input("No XML files found in this directory. Press enter to exit.")
            sys.exit(0)
        elif len(xml_glob) == 1:
            file_paths = [xml_glob[0]]
        else:
            xml_select_string = (
                "Multiple XML files found. Please select any number of them to process.\n"
                "Select files by pressing Space, then confirm your selection by pressing Enter."
            )
            questions = {
                "type": "list",
                "name": "xml_choice",
                "message": xml_select_string,
                "choices": xml_glob,
                "multiselect": True,
            }
            answers = prompt(questions)
            file_paths = answers["xml_choice"]
        return [
            cls.from_file_path(working_directory=working_directory, file_path=file_path) for file_path in file_paths
        ]

    @classmethod
    def from_multiple_orders(cls, orders: list["CardOrder"]) -> "CardOrder":
        """
        Flatten some number of orders into a single `CardOrder`.
        """

        assert len(orders) > 0, "Attempted to produce a CardOrder from multiple CardOrders but none were given!"
        return reduce(lambda a, b: a.combine(b), orders)

    def get_overview(self) -> str:
        return (
            f"Total of {bold(self.details.quantity)} cards. "
            f"{bold(self.details.stock)} cardstock ({bold('foil' if self.details.foil else 'nonfoil')}). "
        )

    # endregion


def aggregate_and_split_orders(
    orders: list[CardOrder], target_site: constants.TargetSites, combine_orders: bool
) -> list[CardOrder]:
    """
    Interactively aggregate multiple card orders into consolidated orders.

    This occurs in two phases:
    1. Combinable orders (orders that share the same finish settings) have their image collections merged.
        * Note: the complexity here is handling different cardbacks between the orders
        * This means that if any orders to be combined have different cardbacks,
          we need to apply the cardback for each project to each slot rather than one slot.
        * Combined orders can have their image collections spill over the max project size.
    2. Split the combined orders back out into multiple orders such that they fit into brackets.
        * For example, combining three 408 card projects will yield two 612 card projects.
        * Note: the complexity here is optimising for cost across brackets in the target site.
          I see users wanting to do this in three ways:
            1. Naively split on max project size (612),
            2. Read pricing data from the target site, perform some calculations, and suggest the optimal
               splits for minimising costs,
                 * Note: out of scope at the moment.
            3. Allow users to type in their desired splits.
    """

    if len(orders) == 1:
        return orders

    def key(order: CardOrder) -> int:
        return hash((order.details.foil, order.details.stock))

    aggregated_orders = orders
    if combine_orders:
        aggregated_orders = [
            CardOrder.from_multiple_orders(list(grouped_orders))
            for _, grouped_orders in groupby(sorted(orders, key=key), key=key)
        ]
    aggregated_and_split_orders = sorted(
        [
            aggregated_and_split_order
            for aggregated_order in aggregated_orders
            for aggregated_and_split_order in aggregated_order.split()
        ],
        key=lambda o: (o.details.stock, o.details.foil, o.details.quantity),
    )

    return aggregated_and_split_orders
