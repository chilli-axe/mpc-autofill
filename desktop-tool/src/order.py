import logging
import math
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from functools import reduce
from glob import glob
from io import BytesIO
from itertools import groupby
from pathlib import Path
from queue import Queue
from tkinter import Tk, filedialog
from typing import Optional
from urllib.parse import quote_plus
from xml.etree.ElementTree import Element, ParseError

import attr
import enlighten
import requests
from defusedxml.ElementTree import parse as defused_parse
from InquirerPy import prompt
from PIL import Image
from sanitize_filename import sanitize

from src import constants
from src.exc import ValidationException
from src.io import (
    CURRDIR,
    download_google_drive_file,
    download_image_from_url,
    file_exists,
    get_google_drive_file_name,
    image_directory,
)
from src.processing import ImagePostProcessingConfig, _add_black_border
from src.utils import bold, text_to_set, unpack_element


def _fetch_and_prepare_image(url: str, card_name: str) -> Optional[str]:
    """Downloads an image from a URL, adds a border, saves it locally, and returns the file path."""
    try:
        safe_name = sanitize(card_name)
        file_name = f"{safe_name}.png"
        save_path = os.path.join(image_directory(), file_name)

        if os.path.exists(save_path):
            logging.info(f"  Using existing image for: {card_name}")
            return save_path

        logging.info(f"  Fetching and bordering: {card_name}")
        response = requests.get(url)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))

        pixel_width, _ = img.size
        if pixel_width > 0:
            effective_dpi = pixel_width / constants.CARD_WIDTH_INCHES
            border_pixels = math.ceil(effective_dpi * constants.BORDER_INCHES)
            img = _add_black_border(img, border_pixels)

        img.save(save_path, "PNG")
        return save_path

    except (requests.exceptions.RequestException, IOError) as e:
        logging.error(f"  Error processing image for '{card_name}': {e}. Skipping.")
        return None


@attr.s
class CardImage:
    drive_id: Optional[str] = attr.ib(default=None)
    image_url: Optional[str] = attr.ib(default=None)
    slots: set[int] = attr.ib(factory=set)
    name: Optional[str] = attr.ib(default="")
    file_path: Optional[str] = attr.ib(default="")
    query: Optional[str] = attr.ib(default=None)

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

        if not self.name and self.drive_id:
            self.name = get_google_drive_file_name(drive_id=self.drive_id)

    def generate_file_path(self) -> None:
        """
        Sets `self.file_path` according to the following logic:
        * If `self.drive_id` points to a valid file in the user's file system, use it as the file path
        * If a file with `self.name` exists in the `cards` directory, use the path to that file as the file path
        * Otherwise, use `self.name` with `self.drive_id` in parentheses in the `cards` directory as the file path.
        """

        if self.drive_id and file_exists(self.drive_id):
            self.file_path = self.drive_id
            self.name = os.path.basename(self.file_path)
            return

        if not self.name:
            self.retrieve_card_name()

        if self.name is None:
            if self.drive_id:
                # assume png
                logging.info(
                    f"The name of the image {bold(self.drive_id)} could not be determined, meaning that its "
                    f"file extension is unknown. As a result, an assumption is made that the file extension "
                    f"is {bold('.png')}."
                )
                self.name = f"{self.drive_id}.png"
                self.file_path = os.path.join(image_directory(), sanitize(self.name))
            else:
                self.file_path = None
        else:
            file_path = os.path.join(image_directory(), sanitize(self.name))
            if not os.path.isfile(file_path) or os.path.getsize(file_path) <= 0:
                # The filepath without ID in parentheses doesn't exist - change the filepath to contain the ID instead
                name_split = self.name.rsplit(".", 1)
                file_path = os.path.join(
                    image_directory(), sanitize(f"{name_split[0]} ({self.drive_id}).{name_split[1]}")
                )
            self.file_path = file_path

    # endregion

    # region initialisation

    def validate(self) -> None:
        self.errored = any([self.errored, self.name is None, self.file_path is None])

    def __attrs_post_init__(self) -> None:
        if not self.file_path:
            self.generate_file_path()
        self.validate()

    # endregion

    # region public

    def combine(self, other: "CardImage") -> "CardImage":
        # Assert that all identifying fields are identical before combining.
        assert self.drive_id == other.drive_id, f"Drive IDs do not match for {self.name}"
        assert self.image_url == other.image_url, f"Image URLs do not match for {self.name}"
        assert self.file_path == other.file_path, f"File paths do not match for {self.name}"

        # If they are identical, combine their slots.
        return attr.evolve(self, slots=self.slots | other.slots)

    @classmethod
    def from_element(cls, element: Element) -> "CardImage":
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
        return card_image

    def download_image(
        self,
        queue: Queue["CardImage"],
        download_bar: enlighten.Counter,
        post_processing_config: Optional[ImagePostProcessingConfig],
    ) -> None:
        try:
            if not self.file_exists() and not self.errored and self.file_path is not None:
                if self.image_url:
                    # Download from URL
                    self.errored = not download_image_from_url(
                        url=self.image_url, file_path=self.file_path, post_processing_config=post_processing_config
                    )
                elif self.drive_id:
                    # Download from Google Drive
                    self.errored = not download_google_drive_file(
                        drive_id=self.drive_id, file_path=self.file_path, post_processing_config=post_processing_config
                    )

            if self.file_exists() and not self.errored:
                self.downloaded = True
            else:
                download_link = self.image_url or (
                    self.drive_id and f"https://drive.google.com/uc?id={self.drive_id}&export=download"
                )
                logging.info(
                    f"Failed to download '{bold(self.name)}' - allocated to slot/s {bold(sorted(self.slots))}.\n"
                    f"Download link - {bold(download_link)}\n"
                )
        except Exception as e:
            download_link = self.image_url or (
                self.drive_id and f"https://drive.google.com/uc?id={self.drive_id}&export=download"
            )
            logging.info(
                f"An uncaught exception occurred when attempting to download '{bold(self.name)}':\n{bold(e)}\n"
                f"Download link - {bold(download_link)}\n"
            )
        finally:
            queue.put(self)
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
    queue: Queue[CardImage] = attr.ib(init=False, default=attr.Factory(Queue))
    num_slots: int = attr.ib(default=0)
    face: constants.Faces = attr.ib(default=constants.Faces.front)

    def append(self, card: CardImage) -> None:
        key = card.drive_id or card.image_url or card.file_path

        if key:
            if key in self.cards_by_id:
                self.cards_by_id[key] = self.cards_by_id[key].combine(card)
            else:
                # Copy the card to avoid side effects
                self.cards_by_id[key] = attr.evolve(card)

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
            # cards_by_id=[*self.cards, *[card.offset_slots(self.num_slots) for card in other.cards]],
            num_slots=self.num_slots + other.num_slots,
            face=self.face,
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
            logging.info(
                f"Warning - the following slots are empty in your order for the {self.face} face: "
                f"{bold(sorted(slots_missing))}"
            )

    # endregion

    # region public

    @classmethod
    def from_element(
        cls, element: Element, num_slots: int, face: constants.Faces, fill_image_id: Optional[str] = None
    ) -> "CardImageCollection":
        card_images: dict[str, CardImage] = {}
        if element:
            for x in element:
                card_image = CardImage.from_element(x)
                key = card_image.drive_id
                if key is not None:
                    if key in card_images:
                        card_images[key] = card_images[key].combine(card_image)
                    else:
                        card_images[key] = card_image
        card_image_collection = cls(cards_by_id=card_images, num_slots=num_slots, face=face)
        if fill_image_id:
            # fill the remaining slots in this card image collection with a new card image based off the given id
            missing_slots = card_image_collection.all_slots() - card_image_collection.slots()
            if missing_slots:
                card_image_collection.append(CardImage(drive_id=fill_image_id.strip(' "'), slots=missing_slots))

        # postponing validation from post-init so we don't error for missing slots that `fill_image_id` would fill
        try:
            card_image_collection.validate()
        except ValidationException as e:
            input(f"There was a problem with your order file:\n{bold(e)}\nPress Enter to exit.")
            sys.exit(0)
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

    def __attrs_post_init__(self) -> None:
        try:
            self.validate()
        except ValidationException as e:
            input(f"There was a problem with your order file:\n\n{bold(e)}\n\nPress Enter to exit.")
            sys.exit(0)

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
        return details

    # endregion


@attr.s
class CardOrder:
    name: Optional[str] = attr.ib(default=None)
    details: Details = attr.ib(default=None)
    fronts: CardImageCollection = attr.ib(default=None)
    backs: CardImageCollection = attr.ib(default=None)

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
                    logging.info(
                        f"There was a problem with your proposed splits (perhaps they didn't sum to "
                        f"{bold(self.details.quantity)}); please try again."
                    )
                    pass
        logging.info(
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

    def __attrs_post_init__(self) -> None:
        try:
            self.validate()
        except ValidationException as e:
            input(f"There was a problem with your order file:\n\n{bold(e)}\n\nPress Enter to exit.")
            sys.exit(0)

    @classmethod
    def from_element(
        cls, element: Element, allowed_to_exceed_project_max_size: bool, name: Optional[str] = None
    ) -> "CardOrder":
        root_dict = unpack_element(element, [x.value for x in constants.BaseTags])
        details = Details.from_element(
            root_dict[constants.BaseTags.details], allowed_to_exceed_project_max_size=allowed_to_exceed_project_max_size
        )
        fronts = CardImageCollection.from_element(
            element=root_dict[constants.BaseTags.fronts], num_slots=details.quantity, face=constants.Faces.front
        )
        cardback_elem = root_dict[constants.BaseTags.cardback]
        if cardback_elem.text is not None:
            backs = CardImageCollection.from_element(
                element=root_dict[constants.BaseTags.backs],
                num_slots=details.quantity,
                face=constants.Faces.back,
                fill_image_id=cardback_elem.text,
            )
        else:
            logging.info(f"{bold('Warning')}: Your order file did not contain a common cardback image.")
            backs = CardImageCollection.from_element(
                element=root_dict[constants.BaseTags.backs], num_slots=details.quantity, face=constants.Faces.back
            )
        order = cls(name=name, details=details, fronts=fronts, backs=backs)
        return order

    @classmethod
    def from_file_path(cls, file_path: str) -> "CardOrder":
        try:
            xml = defused_parse(file_path)
        except ParseError:
            input("Your XML file contains a syntax error so it can't be processed. Press Enter to exit.")
            sys.exit(0)
        file_name = Path(file_path).stem
        logging.info(f"Parsing XML file {bold(file_name)}...")
        order = cls.from_element(xml.getroot(), name=file_name, allowed_to_exceed_project_max_size=True)
        return order

    # endregion

    # region public

    @classmethod
    def from_xmls_in_folder(cls) -> list["CardOrder"]:
        """
        Reads some number of XMLs from the current directory, offering a choice if multiple are detected,
        and populates them with the contents of the selected files.
        The primary public entry point to this class.
        """

        # Ask user for input method
        questions = {
            "type": "list",
            "name": "input_method",
            "message": "How would you like to create your order?",
            "choices": [
                {"name": "From an XML file (MPC autofill)", "value": "xml"},
                {"name": "From a text file (Scryfall downloader)", "value": "decklist"},
            ],
        }
        answers = prompt(questions)
        input_method = answers["input_method"]

        if input_method == "decklist":
            # Create a single order from a decklist and return it in a list
            return [cls.from_decklist()]

        xml_glob = sorted(glob(os.path.join(CURRDIR, "*.xml")))
        if len(xml_glob) <= 0:
            input("No XML files found in this directory. Press enter to exit.")
            sys.exit(0)
        elif len(xml_glob) == 1:
            file_paths = [xml_glob[0]]
        else:
            xml_select_string = "Multiple XML files found. Please select which one to process."
            questions = {
                "type": "list",
                "name": "xml_choice",
                "message": xml_select_string,
                "choices": [{"name": os.path.basename(p), "value": p} for p in xml_glob],
            }
            answers = prompt(questions)
            selected_file = answers.get("xml_choice")
            if selected_file:
                file_paths = [selected_file]
            else:
                file_paths = []

        if not file_paths:
            input("No XML file selected. Press enter to exit.")
            sys.exit(0)

        return [cls.from_file_path(file_path) for file_path in file_paths]

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

    @classmethod
    def from_decklist(cls) -> "CardOrder":
        """
        Creates a CardOrder by prompting the user to select a decklist file and provide order details.
        """
        SCRYFALL_API_BASE_URL = "https://api.scryfall.com"
        REQUEST_DELAY = 1
        blank_back_slots = set()

        # Get User Inputs
        print("\nA file dialog will now open. Please select a decklist .txt file.")
        root = Tk()
        root.attributes("-topmost", True)
        root.withdraw()
        decklist_path = filedialog.askopenfilename(
            parent=root, title="Please select your decklist .txt file", filetypes=[("Text files", "*.txt")]
        )

        if not decklist_path:
            input("No decklist file selected. Press enter to exit.")
            sys.exit(0)

        with open(decklist_path, "r", encoding="utf-8") as f:
            deck_lines = f.readlines()

        details_answers = prompt(
            [
                {
                    "type": "list",
                    "name": "stock",
                    "message": "Select cardstock:",
                    "choices": [s.value for s in constants.Cardstocks],
                },
                {"type": "confirm", "name": "foil", "message": "Are the cards foil?"},
            ]
        )

        print("\nA file dialog will now open. Please select a common card back for this order.")
        card_back_path = filedialog.askopenfilename(parent=root, title="Please select a common card back image")
        root.destroy()
        if not card_back_path:
            input("\nNo card back selected. Exiting program.")
            sys.exit(0)

        # Fetch all card data and defer meld cards
        fronts = CardImageCollection(face=constants.Faces.front)
        backs = CardImageCollection(face=constants.Faces.back)
        current_slot = 0

        meld_cards_in_deck = []

        print("\nParsing decklist and fetching from Scryfall...")
        for line in deck_lines:
            line = line.strip()
            if not line:
                continue

            try:
                qty_str, rest_of_line = line.split(" ", 1)
                card_qty = int(qty_str)
            except ValueError:
                logging.warning(f"Could not parse quantity from line: '{line}'. Skipping.")
                continue

            set_code, number, name = None, None, ""
            set_regex = re.compile(r"\s+\(([^)]+)\)\s+([\w\d-]+)")
            set_match = set_regex.search(rest_of_line)

            if set_match:
                name = rest_of_line[: set_match.start()].strip()
                set_code = set_match.group(1)
                number = set_match.group(2)
            else:
                name = re.split(r"\s*(\/\/|\*F\*|\s\()", rest_of_line, 1)[0].strip()

            if not name:
                logging.warning(f"Could not parse card name from line: '{line}'. Skipping.")
                continue

            api_url = ""
            if set_code and number:
                search_query = f'++!"{name}" set:{set_code} cn:"{number}"'
                api_url = f"{SCRYFALL_API_BASE_URL}/cards/search?q={quote_plus(search_query)}"
            else:
                api_url = f"{SCRYFALL_API_BASE_URL}/cards/named?exact={quote_plus(name)}"

            try:
                time.sleep(REQUEST_DELAY)
                response = requests.get(api_url)
                response.raise_for_status()
                json_response = response.json()

                card_data = None
                if (
                    "object" in json_response
                    and json_response["object"] == "list"
                    and json_response.get("total_cards", 0) > 0
                ):
                    card_data = json_response["data"][0]
                elif "object" in json_response and json_response["object"] == "card":
                    card_data = json_response

                if not card_data:
                    raise ValueError(f"Card not found on Scryfall for query: {name}")

                layout = card_data.get("layout", "normal")

                if layout == "meld":
                    logging.info(f"  Deferring Meld Part: {name}")
                    meld_cards_in_deck.append({"data": card_data, "qty": card_qty})
                else:
                    if (
                        layout in ["transform", "modal_dfc", "double_faced_token", "reversible_card"]
                        and "card_faces" in card_data
                        and len(card_data["card_faces"]) > 1
                    ):
                        face_front, face_back = card_data["card_faces"][0], card_data["card_faces"][1]
                        url_front = face_front.get("image_uris", {}).get("png")
                        url_back = face_back.get("image_uris", {}).get("png")

                        if url_front:
                            logging.info(f"  Found DFC: {name}")
                            front_path = _fetch_and_prepare_image(url_front, face_front.get("name"))
                            back_path = None
                            if url_back:
                                back_path = _fetch_and_prepare_image(url_back, face_back.get("name"))
                            else:
                                logging.warning(f"Back face missing for '{name}'. It will be left blank.")

                            if front_path:
                                for _ in range(card_qty):
                                    fronts.append(
                                        CardImage(
                                            file_path=front_path,
                                            name=os.path.basename(front_path),
                                            slots={current_slot},
                                        )
                                    )
                                    if back_path:
                                        backs.append(
                                            CardImage(
                                                file_path=back_path,
                                                name=os.path.basename(back_path),
                                                slots={current_slot},
                                            )
                                        )
                                    else:
                                        blank_back_slots.add(current_slot)
                                    current_slot += 1

                    else:
                        image_url = card_data.get("image_uris", {}).get("png")
                        if image_url:
                            logging.info(f"  Found SFC: {name} (layout: {layout})")
                            image_path = _fetch_and_prepare_image(image_url, card_data.get("name"))
                            if image_path:
                                for _ in range(card_qty):
                                    fronts.append(
                                        CardImage(
                                            file_path=image_path,
                                            name=os.path.basename(image_path),
                                            slots={current_slot},
                                        )
                                    )
                                    current_slot += 1
            except (requests.exceptions.RequestException, ValueError) as e:
                logging.error(f"  Error finding '{name}': {e}. Skipping.")

        # Group and process deferred meld cards
        if meld_cards_in_deck:
            logging.info("\nProcessing meld cards...")
            meld_groups = {}
            for card_info in meld_cards_in_deck:
                result_part = next(
                    (p for p in card_info["data"].get("all_parts", []) if p.get("component") == "meld_result"), None
                )
                if result_part and result_part.get("uri"):
                    if result_part["uri"] not in meld_groups:
                        meld_groups[result_part["uri"]] = {
                            "all_parts": card_info["data"]["all_parts"],
                            "cards_to_add": [],
                        }
                    meld_groups[result_part["uri"]]["cards_to_add"].append(card_info)
                else:
                    logging.warning(
                        f"Meld result data missing for '{card_info['data']['name']}'. Back will be left blank."
                    )
                    image_url = card_info["data"].get("image_uris", {}).get("png")
                    if image_url:
                        front_path = _fetch_and_prepare_image(image_url, card_info["data"]["name"])
                        if front_path:
                            for _ in range(card_info["qty"]):
                                fronts.append(
                                    CardImage(
                                        file_path=front_path, name=os.path.basename(front_path), slots={current_slot}
                                    )
                                )
                                blank_back_slots.add(current_slot)
                                current_slot += 1

            for result_uri, group in meld_groups.items():
                try:
                    meld_parts_data = [p for p in group["all_parts"] if p.get("component") == "meld_part"]
                    if len(meld_parts_data) != 2:
                        raise ValueError(f"Expected 2 meld parts, but found {len(meld_parts_data)}")

                    logging.info(
                        f"  Processing meld group for: {meld_parts_data[0]['name']} & {meld_parts_data[1]['name']}"
                    )
                    result_res = requests.get(result_uri)
                    result_data = result_res.json()
                    result_image_url = result_data.get("image_uris", {}).get("png")
                    if not result_image_url:
                        raise ValueError("Meld result has no png image_uri")

                    meld_image_response = requests.get(result_image_url)
                    meld_image_response.raise_for_status()
                    img = Image.open(BytesIO(meld_image_response.content))

                    width, height = img.size
                    top_half = img.crop((0, 0, width, height // 2))
                    bottom_half = img.crop((0, height // 2, width, height))
                    top_half, bottom_half = top_half.transpose(Image.Transpose.ROTATE_90), bottom_half.transpose(
                        Image.Transpose.ROTATE_90
                    )

                    border_top = math.ceil((top_half.size[0] / constants.CARD_WIDTH_INCHES) * constants.BORDER_INCHES)
                    border_bottom = math.ceil(
                        (bottom_half.size[0] / constants.CARD_WIDTH_INCHES) * constants.BORDER_INCHES
                    )

                    top_path = os.path.join(image_directory(), f"meld_back_{sanitize(meld_parts_data[0]['name'])}.png")
                    bottom_path = os.path.join(
                        image_directory(), f"meld_back_{sanitize(meld_parts_data[1]['name'])}.png"
                    )
                    _add_black_border(top_half, border_top).save(top_path)
                    _add_black_border(bottom_half, border_bottom).save(bottom_path)

                    back_paths = {meld_parts_data[0]["id"]: top_path, meld_parts_data[1]["id"]: bottom_path}

                    for card_info in group["cards_to_add"]:
                        card_data, qty = card_info["data"], card_info["qty"]
                        back_path = back_paths.get(card_data["id"])

                        image_url = card_data.get("image_uris", {}).get("png")
                        if not image_url:
                            continue

                        front_path = _fetch_and_prepare_image(image_url, card_data["name"])

                        if front_path:
                            for _ in range(qty):
                                fronts.append(
                                    CardImage(
                                        file_path=front_path, name=os.path.basename(front_path), slots={current_slot}
                                    )
                                )
                                if back_path:
                                    backs.append(
                                        CardImage(
                                            file_path=back_path, name=os.path.basename(back_path), slots={current_slot}
                                        )
                                    )
                                else:
                                    blank_back_slots.add(current_slot)
                                current_slot += 1
                except Exception as e:
                    card_names = [c["data"]["name"] for c in group["cards_to_add"]]
                    logging.error(
                        f"Could not process meld back for: {', '.join(card_names)}. Backs will be left blank. Reason: {e}"
                    )
                    for card_info in group["cards_to_add"]:
                        image_url = card_info["data"].get("image_uris", {}).get("png")
                        if image_url:
                            front_path = _fetch_and_prepare_image(image_url, card_info["data"]["name"])
                            if front_path:
                                for _ in range(card_info["qty"]):
                                    fronts.append(
                                        CardImage(
                                            file_path=front_path,
                                            name=os.path.basename(front_path),
                                            slots={current_slot},
                                        )
                                    )
                                    blank_back_slots.add(current_slot)
                                    current_slot += 1

        # Finalize and create order
        total_quantity = current_slot
        if total_quantity == 0:
            input("Could not find any cards from the provided decklist. Press enter to exit.")
            sys.exit(0)

        fronts.num_slots, backs.num_slots = total_quantity, total_quantity

        if card_back_path:
            slots_for_common_back = set(range(total_quantity)) - backs.slots() - blank_back_slots
            if slots_for_common_back:
                backs.append(
                    CardImage(
                        file_path=card_back_path, name=os.path.basename(card_back_path), slots=slots_for_common_back
                    )
                )

        details = Details(
            quantity=total_quantity,
            stock=details_answers["stock"],
            foil=details_answers["foil"],
            allowed_to_exceed_project_max_size=True,
        )
        deck_name = sanitize(input("\nEnter a name for this deck/order: ").strip()) or "Decklist Order"

        return cls(name=deck_name, details=details, fronts=fronts, backs=backs)

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
