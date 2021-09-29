import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from glob import glob
from queue import Queue
from typing import Dict, List, Set
from xml.etree import ElementTree

import attr
import constants
import enlighten
import PyInquirer  # TODO: this package is unmaintained and crashes when you click in terminal on macos
import requests
from numpy import array, uint8
from requests import exceptions as re_exc
from utils import (CURRDIR, TEXT_BOLD, TEXT_END, ValidationException,
                   file_exists, text_to_list, unpack_element)


@attr.s
class CardImage:
    # TODO: file size from google scripts api as validation that the file exists on gdrive?
    # TODO: new API endpoint on google scripts that takes a list of image IDs and returns their total size?

    drive_id: str = attr.ib(default="")
    slots: List[int] = attr.ib(default=[])
    name: str = attr.ib(default="")
    file_path: str = attr.ib(default="")
    query: str = attr.ib(default="")

    downloaded: bool = attr.ib(init=False, default=False)
    uploaded: bool = attr.ib(init=False, default=False)
    errored: bool = attr.ib(init=False, default=False)

    @classmethod
    def from_dict(cls, card_dict: Dict[str, str]) -> "CardImage":
        # assert that the keys of the input dict contains constants.CardTags
        drive_id = card_dict[constants.CardTags.id]
        slots = text_to_list(card_dict[constants.CardTags.slots])
        name = card_dict[constants.CardTags.name]
        query = card_dict[constants.CardTags.query]
        card_image = cls(drive_id=drive_id, slots=slots, name=name, query=query)
        return card_image

    def __attrs_post_init__(self):
        self.generate_file_path()
        self.validate()

    def validate(self) -> None:
        pass  # TODO

    def retrieve_card_name(self) -> None:
        if not self.name:
            try:
                # TODO: rate limiting to 0.1s per query - can we use a decorator to rate-limit all API calls?
                time.sleep(0.1)
                with requests.post(
                    constants.GoogleScriptsAPIs.image_name.value,
                    data={"id": self.drive_id},
                    timeout=30,
                ) as r_info:
                    self.name = r_info.json()["name"]
            except re_exc.Timeout:
                self.name = ""
                # TODO: error handling that doesn't cancel the entire order

    @classmethod
    def image_directory(cls) -> str:
        cards_folder = CURRDIR + "/cards"
        if not os.path.exists(cards_folder):
            os.mkdir(cards_folder)
        return cards_folder

    def generate_file_path(self) -> None:
        # file paths for local files are stored in the `id` field. If the `id` field corresponds to a file that exists
        # in the file system, assume that's the card's file path.
        if file_exists(self.drive_id):
            self.file_path = self.drive_id
            return

        if not self.name:
            self.retrieve_card_name()

        file_path = os.path.join(self.image_directory(), self.name)
        if not os.path.isfile(file_path) or os.path.getsize(file_path) <= 0:
            # The filepath without ID in parentheses doesn't exist - change the filepath to contain the ID instead
            name_split = self.name.rsplit(".", 1)
            file_path = os.path.join(
                self.image_directory(),
                f"{name_split[0]} ({self.drive_id}).{name_split[1]}",
            )
        self.file_path = file_path

    def download_image(self, queue: Queue, download_bar: enlighten.Counter):
        if not self.file_exists():
            try:
                # Five attempts at downloading the image, in case the api returns an empty image for whatever reason
                attempt_counter = 0
                image_downloaded = False
                while attempt_counter < 5 and not image_downloaded:
                    with requests.post(
                        constants.GoogleScriptsAPIs.image_content.value,
                        data={"id": self.drive_id},
                        timeout=120,
                    ) as r_contents:
                        if "<title>Error</title>" in r_contents.text:
                            # error occurred while attempting to retrieve from Google API
                            self.errored = True
                            break
                        filecontents = r_contents.json()["result"]
                        if len(filecontents) > 0:
                            # Download the image
                            # TODO: doable w/o numpy dependency?
                            f = open(self.file_path, "bw")
                            f.write(array(filecontents, dtype=uint8))
                            f.close()
                            image_downloaded = True
                        else:
                            attempt_counter += 1
            except requests.Timeout:
                pass

        if self.file_exists():
            self.downloaded = True
        else:
            print(
                f'Failed to download "{TEXT_BOLD}{self.name}{TEXT_END}" (Drive ID {TEXT_BOLD}{self.drive_id}{TEXT_END})'
            )
        # put card onto queue irrespective of whether it was downloaded successfully or not
        queue.put(self)
        download_bar.update()

    def file_exists(self) -> bool:
        """
        Determines whether this image has been downloaded successfully.
        """

        return file_exists(self.file_path)


@attr.s
class CardImageCollection:
    """
    A collection of CardImages for one face of a CardOrder.
    """

    cards: List[CardImage] = attr.ib(default=[])
    queue: Queue = attr.ib(init=False, default=attr.Factory(Queue))
    num_slots: int = attr.ib(default=0)
    face: constants.Faces = attr.ib(default=constants.Faces.front)

    @classmethod
    def from_element(
        cls,
        element: ElementTree,
        num_slots,
        face: constants.Faces,
        fill_image_id: str = None,
    ) -> "CardImageCollection":
        card_images = []
        if element:
            for x in element:
                card_dict = unpack_element(
                    x, [x.value for x in constants.CardTags], unpack_to_text=True
                )
                card_images.append(CardImage.from_dict(card_dict))
        card_image_collection = cls(cards=card_images, num_slots=num_slots, face=face)
        if fill_image_id:
            # fill the remaining slots in this card image collection with a new card image based off the given id
            pass
            missing_slots = (
                card_image_collection.all_slots() - card_image_collection.slots()
            )
            if missing_slots:
                card_image_collection.cards.append(
                    CardImage(
                        drive_id=fill_image_id,
                        slots=list(missing_slots),
                    )
                )

        # postponing validation from post-init so we don't error for missing slots that `fill_image_id` would fill
        try:
            card_image_collection.validate()
        except ValidationException as e:
            input(
                f"There was a problem with your order file:\n\n{TEXT_BOLD}{e}{TEXT_END}\n\nPress Enter to exit."
            )
            sys.exit(0)
        return card_image_collection

    def all_slots(self) -> Set[int]:
        return set(range(0, self.num_slots))

    def slots(self) -> Set[int]:
        return {y for x in self.cards for y in x.slots}

    def validate(self) -> None:
        if self.num_slots == 0:
            raise ValidationException(f"{self.face} has no images!")
        slots_missing = self.all_slots() - self.slots()
        if slots_missing:
            raise ValidationException(
                f"The following slots are empty in your order for the {self.face} face: "
                f"{TEXT_BOLD}{sorted(slots_missing)}{TEXT_END}"
            )

    def download_images(
        self, pool: ThreadPoolExecutor, download_bar: enlighten.Counter
    ) -> None:
        """
        Set up the provided ThreadPoolExecutor to download this collection's images, updating the given progress
        bar with each image. Async function.
        """

        pool.map(lambda x: x.download_image(self.queue, download_bar), self.cards)


@attr.s
class Details:
    quantity: int = attr.ib(default=0)
    bracket: int = attr.ib(default=0)
    stock: str = attr.ib(default=0)
    foil: bool = attr.ib(default=False)

    @classmethod
    def from_element(cls, element: ElementTree.Element) -> "Details":
        details_dict = unpack_element(element, [x.value for x in constants.DetailsTags])
        quantity: int = int(details_dict[constants.DetailsTags.quantity].text)
        bracket: int = int(details_dict[constants.DetailsTags.bracket].text)
        stock: str = details_dict[constants.DetailsTags.stock].text
        foil: bool = details_dict[constants.DetailsTags.foil].text == "true"

        details = cls(quantity=quantity, bracket=bracket, stock=stock, foil=foil)
        return details

    def __attrs_post_init__(self):
        try:
            self.validate()
        except ValidationException as e:
            input(
                f"There was a problem with your order file:\n\n{TEXT_BOLD}{e}{TEXT_END}\n\nPress Enter to exit."
            )
            sys.exit(0)

    def validate(self) -> None:
        if not 0 < self.quantity <= constants.BRACKETS[-1]:
            raise ValidationException(
                f"Order quantity {self.quantity} outside allowable range of 0 to {constants.BRACKETS[-1]}!"
            )
        if self.bracket not in constants.BRACKETS:
            raise ValidationException(f"Order bracket {self.bracket} not supported!")
        if self.stock not in [x.value for x in constants.Cardstocks]:
            raise ValidationException(f"Order cardstock {self.stock} not supported!")


@attr.s
class CardOrder:
    details: Details = attr.ib(default=None)
    fronts: CardImageCollection = attr.ib(default=None)
    backs: CardImageCollection = attr.ib(default=None)

    @classmethod
    def from_xml_in_folder(cls) -> "CardOrder":
        """
        Reads an XML from the current directory, offering a choice if multiple are detected, and populates this
        object with the contents of the file.
        """

        xml_glob = list(glob(os.path.join(CURRDIR, "*.xml")))
        if len(xml_glob) <= 0:
            input("No XML files found in this directory. Press enter to exit.")
            sys.exit(0)
        elif len(xml_glob) == 1:
            file_name = xml_glob[0]
        else:
            xml_select_string = (
                "Multiple XML files found. Please select one for this order: "
            )
            questions = {
                "type": "list",
                "name": "xml_choice",
                "message": xml_select_string,
                "choices": xml_glob,
            }
            answers = PyInquirer.prompt(questions, style=PyInquirer.default_style)
            file_name = answers["xml_choice"]
        return cls.from_file_name(file_name)

    @classmethod
    def from_file_name(cls, file_name: str) -> "CardOrder":
        try:
            xml = ElementTree.parse(file_name)
        except ElementTree.ParseError:
            input(
                "Your XML file contains a syntax error so it can't be processed. Press Enter to exit."
            )
            sys.exit(0)
        order = cls.from_element_tree(xml)
        print(
            f"Successfully read XML file: {TEXT_BOLD}{file_name}{TEXT_END}\n"
            f"Your order has a total of {TEXT_BOLD}{order.details.quantity}{TEXT_END} cards, in the MPC bracket of up "
            f"to {TEXT_BOLD}{order.details.bracket}{TEXT_END} cards.\n{TEXT_BOLD}{order.details.stock}{TEXT_END} "
            f"cardstock ({TEXT_BOLD}{'foil' if order.details.foil else 'nonfoil'}{TEXT_END}).\n"
        )

        return order

    @classmethod
    def from_element_tree(cls, xml: ElementTree.ElementTree) -> "CardOrder":
        root = xml.getroot()
        root_dict = unpack_element(root, [x.value for x in constants.BaseTags])
        details = Details.from_element(root_dict[constants.BaseTags.details])
        fronts = CardImageCollection.from_element(
            element=root_dict[constants.BaseTags.fronts],
            num_slots=details.quantity,
            face=constants.Faces.front,
        )
        cardback_elem = root_dict[constants.BaseTags.cardback]
        if cardback_elem is not None:
            backs = CardImageCollection.from_element(
                element=root_dict[constants.BaseTags.backs],
                num_slots=details.quantity,
                face=constants.Faces.back,
                fill_image_id=cardback_elem.text,
            )
        else:
            print(
                f"{TEXT_BOLD}Warning{TEXT_END}: Your order file did not contain a common cardback image."
            )
            backs = CardImageCollection.from_element(
                element=root_dict[constants.BaseTags.backs],
                num_slots=details.quantity,
                face=constants.Faces.back,
            )

        order = cls(details=details, fronts=fronts, backs=backs)
        return order

    def __attrs_post_init__(self):
        try:
            self.validate()
        except ValidationException as e:
            input(
                f"There was a problem with your order file:\n\n{TEXT_BOLD}{e}{TEXT_END}\n\nPress Enter to exit."
            )
            sys.exit(0)

    def validate(self) -> None:
        # TODO: validate that all images have file paths
        # TODO: validate that all images exist in google scripts API (might be neat to report on size of order in MB?)
        pass
