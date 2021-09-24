import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from glob import glob
from queue import Queue
from typing import Dict, List, Set
from xml.etree import ElementTree

import attr
import constants
import PyInquirer  # TODO: this package is unmaintained and crashes when you click in terminal on macos
import requests
from driver import AutofillDriver
from numpy import array, uint8
from requests import exceptions as re_exc
from utils import CURRDIR, TEXT_BOLD, TEXT_END, text_to_list, unpack_element


@attr.s
class CardImage:
    # TODO: file size from google scripts api as validation that the file exists on gdrive?
    # TODO: new API endpoint on google scripts that takes a list of image IDs and returns their total size?

    drive_id = attr.ib(type=str, default="")
    slots = attr.ib(type=List[int], default=[])
    name = attr.ib(type=str, default="")
    file_path = attr.ib(type=str, default="")
    query = attr.ib(type=str, default="")
    bar = attr.ib(type=str, default="")  # TODO

    downloaded = attr.ib(type=bool, default=False)
    uploaded = attr.ib(type=bool, default=False)
    errored = attr.ib(type=bool, default=False)

    @classmethod
    def from_dict(cls, card_dict: Dict[str, str]) -> "CardImage":  # TODO: progress bar
        # assert that the keys of the input dict contains constants.CardTags
        drive_id = card_dict[constants.CardTags.id]
        slots = text_to_list(card_dict[constants.CardTags.slots])
        name = card_dict[constants.CardTags.name]
        query = card_dict[constants.CardTags.query]
        card_image = cls(drive_id=drive_id, slots=slots, name=name, query=query)
        card_image.retrieve_card_name()
        card_image.generate_file_path()
        card_image.validate()
        return card_image

    def validate(self) -> None:
        pass

    def retrieve_card_name(self) -> None:
        if not self.name:
            try:
                # TODO: rate limiting to 0.1s per query - can we use a decorator to rate-limit all API calls?
                time.sleep(0.1)
                with requests.post(
                    "https://script.google.com/macros/s/AKfycbw90rkocSdppkEuyVdsTuZNslrhd5zNT3XMgfucNMM1JjhLl-Q/exec",
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

    # def generate_filepath(cls, drive_id: str, file_name: str = None) -> str:
    def generate_file_path(self) -> None:
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
        """
        # in the case of file name request failing, filepath will be referenced before assignment unless we do this
        filepath = ""
        if filename:
            # Split the filename on extension and add in the ID as well
            # The filename with and without the ID in parentheses is checked for, so if the user downloads the image from
            # Google Drive without modifying the filename, it should work as expected
            # However, looking for the file with the ID in parentheses is preferred because it eliminates the possibility
            # of filename clashes between different images
            filename_split = filename.rsplit(".", 1)
            filename_id = filename_split[0] + " (" + file_id + ")." + filename_split[1]

            # Filepath from filename
            # TODO: os.path.join?
            filepath = cards_folder + "/" + filename

            if not os.path.isfile(filepath) or os.path.getsize(filepath) <= 0:
                # The filepath without ID in parentheses doesn't exist - change the filepath to contain the ID instead
                filepath = cards_folder + "/" + filename_id

            # Download the image if it doesn't exist, or if it does exist but it's empty
            if (not os.path.isfile(filepath)) or os.path.getsize(filepath) <= 0:
                # Google script request for file contents
                # Set the request's timeout to 30 seconds, so if the server decides to not respond, we can
                # move on without stopping the whole autofill process    )) > 0 and text_to_list(cardinfo[1])[0] > 10:
                try:

                    # Five attempts at downloading the image, in case the api returns an empty image for whatever reason
                    attempt_counter = 0
                    image_downloaded = False
                    while attempt_counter < 5 and not image_downloaded:

                        with requests_post(
                                "https://script.google.com/macros/s/AKfycbzzCWc2x3tfQU1Zp45LB1P19FNZE-4njwzfKT5_Rx399h-5dELZWyvf/exec",
                                data={"id": file_id},
                                timeout=120,
                        ) as r_contents:

                            # Check if the response returned any data
                            filecontents = r_contents.json()["result"]
                            if len(filecontents) > 0:
                                # Download the image
                                f = open(filepath, "bw")
                                f.write(np_array(filecontents, dtype=np_uint8))
                                f.close()
                                image_downloaded = True
                            else:
                                attempt_counter += 1

                    if not image_downloaded:
                        # Tried to download image three times and never got any data, add to error queue
                        q_error.put(
                            f"{TEXT_BOLD}{filename}{TEXT_END}:\n  https://drive.google.com/uc?id={file_id}&export=download"
                        )

                except requests_Timeout:
                    # Failed to download image because of a timeout error - add it to error queue
                    q_error.put(
                        f"{TEXT_BOLD}{filename}{TEXT_END}:\n  https://drive.google.com/uc?id={file_id}&export=download"
                    )
        """

    def download_image(self, queue: Queue):
        # progress bar update
        if not self.file_exists():
            try:
                # Five attempts at downloading the image, in case the api returns an empty image for whatever reason
                attempt_counter = 0
                image_downloaded = False
                while attempt_counter < 5 and not image_downloaded:
                    with requests.post(
                        "https://script.google.com/macros/s/AKfycbzzCWc2x3tfQU1Zp45LB1P19FNZE-4njwzfKT5_Rx399h-5dELZWyvf/exec",
                        data={"id": self.drive_id},
                        timeout=120,
                    ) as r_contents:
                        if "<title>Error</title>" in r_contents.text:
                            # error occurred while attempting to retrieve from Google API
                            self.errored = True
                            return
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
                # TODO: error reporting
                pass

        if self.file_exists():
            self.downloaded = True
            queue.put(self)

    def file_exists(self) -> bool:
        """
        Determines whether this image has been downloaded successfully.
        """

        return (
            self.file_path != ""
            and os.path.isfile(self.file_path)
            and os.path.getsize(self.file_path) > 0
        )


@attr.s
class CardImageCollection:
    """
    A collection of CardImages for one face of a CardOrder.
    """

    cards = attr.ib(type=List[CardImage], default=[])
    queue = attr.ib(type=Queue, default=Queue())
    num_slots = attr.ib(type=int, default=0)

    @classmethod
    def from_element(
        cls, element: ElementTree, num_slots, fill_image_id: str = None
    ) -> "CardImageCollection":
        card_images = []
        if element:
            for x in element:
                card_dict = unpack_element(
                    x, [x.value for x in constants.CardTags], unpack_to_text=True
                )
                card_images.append(CardImage.from_dict(card_dict))
        card_image_collection = cls(cards=card_images, num_slots=num_slots)
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

        card_image_collection.validate()
        return card_image_collection

    def all_slots(self) -> Set[int]:
        return set(range(0, self.num_slots))

    def slots(self) -> Set[int]:
        return {y for x in self.cards for y in x.slots}

    def validate(self) -> None:
        assert self.num_slots > 0
        slots_missing = self.all_slots() - self.slots()
        if slots_missing:
            print("cooked")
            # TODO: we should raise an exception here, and there should be built-in handling for any exception that
            # diplays an error message to the user with a prompt to press any key to close the window

    def download_images(self, bar) -> None:
        """
        Spins up Constants.THREADS threads to download images from this collection's images, putting
        the downloaded images' details onto this collection's queue. Async function.
        """

        with ThreadPoolExecutor(max_workers=constants.THREADS) as pool:
            pool.map(lambda x: x.download_image(self.queue), self.cards)


@attr.s
class Details:
    quantity = attr.ib(type=int, default=0)
    bracket = attr.ib(type=int, default=0)
    stock = attr.ib(type=str, default=0)
    foil = attr.ib(type=bool, default=False)

    @classmethod
    def from_element(cls, element: ElementTree.Element) -> "Details":
        details_dict = unpack_element(element, [x.value for x in constants.DetailsTags])
        quantity: int = int(details_dict[constants.DetailsTags.quantity].text)
        bracket: int = int(details_dict[constants.DetailsTags.bracket].text)
        stock: str = details_dict[constants.DetailsTags.stock].text
        foil: bool = details_dict[constants.DetailsTags.foil].text == "true"

        details = cls(quantity=quantity, bracket=bracket, stock=stock, foil=foil)
        details.validate()
        return details

    def validate(self) -> None:
        assert 0 < self.quantity <= constants.BRACKETS[-1]
        assert self.stock in [x.value for x in constants.Cardstocks]
        assert self.bracket in constants.BRACKETS


@attr.s
class CardOrder:
    details = attr.ib(type=Details, default=None)
    fronts = attr.ib(type=CardImageCollection, default=[])
    backs = attr.ib(type=CardImageCollection, default=[])

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
            f"cardstock ({TEXT_BOLD}{'foil' if order.details.foil else 'nonfoil'}{TEXT_END}).\n\n"
            f"Starting card downloader and webdriver processes."
        )

        return order

    @classmethod
    def from_element_tree(cls, xml: ElementTree.ElementTree) -> "CardOrder":
        root = xml.getroot()
        root_dict = unpack_element(root, [x.value for x in constants.BaseTags])
        details = Details.from_element(root_dict[constants.BaseTags.details])
        fronts = CardImageCollection.from_element(
            root_dict[constants.BaseTags.fronts], details.quantity
        )
        backs = CardImageCollection.from_element(
            root_dict[constants.BaseTags.backs],
            details.quantity,
            fill_image_id=root_dict[constants.BaseTags.cardback].text,
        )

        order = cls(details=details, fronts=fronts, backs=backs)
        order.validate()

        return order

    def validate(self) -> None:
        # TODO: validate that all images have file paths
        # TODO: validate that all images exist in google scripts API (might be neat to report on size of order in MB?)
        pass

    def execute(self, autofill_driver: AutofillDriver) -> None:
        # create progress bars and state text, setup multithreading
        # TODO: these aren't running asynchronously
        self.fronts.download_images("")
        self.backs.download_images("")

        autofill_driver.define_order(self.details)
        autofill_driver.insert_fronts(self.details, self.fronts)
