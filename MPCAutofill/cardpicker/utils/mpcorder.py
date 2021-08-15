"""
Object Model for working with MPCOrders - the data structure that defines a user's card order
"""

import csv
import json
from collections import abc
from dataclasses import dataclass
from enum import Enum
from typing import (AbstractSet, Any, Dict, ItemsView, Iterator, List, Set,
                    Tuple, ValuesView)

import chardet
import defusedxml.ElementTree as ET
import requests

from cardpicker.models import DFCPair
from cardpicker.utils.search_functions import process_line, text_to_list
from cardpicker.utils.to_searchable import to_searchable


class ParsingErrors:
    class MalformedXMLException(Exception):
        def __init__(self):
            self.message = "The input XML file contained a syntax error."
            super().__init__(self.message)

    class MissingElementException(Exception):
        def __init__(self, element, index):
            self.message = f"Your XML file wasn't structured correctly. The {element} element was expected at index {index}."
            super().__init__(self.message)

    class SiteNotSupportedException(Exception):
        def __init__(self, url):
            self.message = (
                f"Importing card lists from {url} is not supported. Sorry about that!"
            )
            super().__init__(self.message)

    class InvalidURLException(Exception):
        def __init__(self, site, url):
            self.message = f"There was a problem with importing your list from {site} at URL {url}. Check that your URL is correct and try again."
            super().__init__(self.message)


@dataclass
class ImportSite:
    name: str
    base_url: str

    def retrieve_card_list(self, url: str) -> str:
        raise NotImplementedError


class TappedOut(ImportSite):
    def __init__(self):
        self.name = "TappedOut"
        self.base_url = "https://tappedout.net"

    def retrieve_card_list(self, url: str) -> str:
        response = requests.get(url + "?fmt=txt")
        if response.status_code == 404:
            raise ParsingErrors.InvalidURLException(self.name, url)
        card_list = response.content.decode("utf-8")
        for x in ["Sideboard:"]:
            card_list = card_list.replace(x + "\r\n", "")
        return card_list


class CubeCobra(ImportSite):
    def __init__(self):
        self.name = "CubeCobra"
        self.base_url = "https://cubecobra.com"

    def retrieve_card_list(self, url: str) -> str:
        cube_id = url.split("/")[-1]
        response = requests.get(
            f"{self.base_url}/cube/download/plaintext/{cube_id}?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=false"
        )
        if (
            response.url == "https://cubecobra.com/404" or not cube_id
        ):  # cubecobra returns code 200 for 404 page
            raise ParsingErrors.InvalidURLException(self.name, url)
        return response.content.decode("utf-8")


class MTGGoldfish(ImportSite):
    def __init__(self):
        self.name = "MTGGoldfish"
        self.base_url = "https://www.mtggoldfish.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.split("#")[0].split("/")[-1]
        response = requests.get(f"{self.base_url}/deck/download/{deck_id}")
        if response.status_code == 404 or not deck_id:
            raise ParsingErrors.InvalidURLException(self.name, url)
        return response.content.decode("utf-8")


class Scryfall(ImportSite):
    def __init__(self):
        self.name = "Scryfall"
        self.base_url = "https://scryfall.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.rsplit("#", 1)[0].split("/")[-1]
        response = requests.get(f"https://api.scryfall.com/decks/{deck_id}/export/text")
        if response.status_code == 404 or not deck_id:
            raise ParsingErrors.InvalidURLException(self.name, url)
        card_list = response.content.decode("utf-8")
        for x in ["// Sideboard"]:
            card_list = card_list.replace(x, "")
        return card_list


class Archidekt(ImportSite):
    def __init__(self):
        self.name = "Archidekt"
        self.base_url = "https://archidekt.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.rsplit("#", 1)[0].split("/")[-1]
        response = requests.get(f"{self.base_url}/api/decks/{deck_id}/small/")
        if response.status_code == 404 or not deck_id:
            raise ParsingErrors.InvalidURLException(self.name, url)
        response_json = json.loads(response.content.decode("utf-8"))
        card_list = ""
        for x in response_json["cards"]:
            card_list += f"{x['quantity']} {x['card']['oracleCard']['name']}\n"
        return card_list


ImportSites = [TappedOut, CubeCobra, MTGGoldfish, Scryfall, Archidekt]
# TODO: reach out to Moxfield, Deckstats, and Aetherhub regarding data integration


class Cardstocks(Enum):
    S30 = "(S30) Standard Smooth"
    S33 = "(S33) Superior Smooth"
    M31 = "(M31) Linen"
    P10 = "(P10) Plastic"


class ReqTypes(Enum):
    CARD = ""
    TOKEN = "token"
    CARDBACK = "back"


class Faces(Enum):
    FRONT = "front"
    BACK = "back"
    FACES = [FRONT, BACK]


class CSVHeaders(Enum):
    FRONT = "Front"
    BACK = "Back"
    QTY = "Quantity"


class CardImage:
    def __init__(self, query: str, slots: Set[Tuple[Any, str]], req_type: str):
        if not query:
            query = ""
        self.query = query
        self.slots = (
            slots  # slots is a set of tuples where each tuple is (slot, image id)
        )
        self.req_type = req_type
        self.data = []

    def add_slots(self, new_slots: Set[Tuple[Any, str]]):
        self.slots |= new_slots

    def insert_data(self, results):
        # search results data - populated in ajax callbacks
        self.data = results["data"]
        self.query = results["query"]
        self.req_type = results["req_type"]

    def __str__(self):
        return f"'{self.query}': '{self.req_type}', with slots:\n    {self.slots}"

    def to_dict(self):
        return {
            "query": self.query,
            "slots": [list(x) for x in self.slots],
            "req_type": self.req_type,
            "data": self.data,
        }


class CardbackImage(CardImage):
    def __init__(self):
        super(CardbackImage, self).__init__("", {("-", "")}, ReqTypes.CARDBACK.value)

    def remove_common_cardback(self):
        common_cardback_elem = [x for x in self.slots if x[0] == "-"]
        if common_cardback_elem:
            self.slots.remove(common_cardback_elem[0])


class CardImageCollection(abc.MutableMapping):
    def __setitem__(self, key: str, value: CardImage) -> None:
        self.__dict__[key] = value

    def __delitem__(self, key: str) -> None:
        del self.__dict__[key]

    def __len__(self) -> int:
        return len(self.__dict__)

    def __iter__(self) -> Iterator[str]:
        return iter(self.__dict__)

    def __getitem__(self, key: str) -> CardImage:
        return self.__dict__[key]

    def keys(self) -> AbstractSet[str]:
        return self.__dict__.keys()

    def values(self) -> ValuesView[CardImage]:
        return self.__dict__.values()

    def items(self) -> ItemsView[str, CardImage]:
        return self.__dict__.items()

    def __init__(self):
        self.__dict__: Dict[str, CardImage] = {}

    def insert_with_ids(self, query: str, slots: Set[Tuple[Any, str]], req_type: str):
        # create a CardImage and insert into the dictionary
        if query not in self.keys():
            self[query] = CardImage(query, slots, req_type)
        else:
            # update the CardImage with the given query with more slots
            self[query].add_slots(slots)

    def insert(self, query: str, slots: List[Any], req_type: str, selected_img: str):
        slots_with_id = {(x, selected_img) for x in slots}
        self.insert_with_ids(query, slots_with_id, req_type)

    def __str__(self):
        return f"contains the following:\n" + "\n".join(str(x) for x in self.values())

    def to_dict(self):
        return {key: value.to_dict() for key, value in self.items()}


class MPCOrder(abc.MutableMapping):
    def __setitem__(self, key: str, value: CardImageCollection) -> None:
        self.__dict__[key] = value

    def __delitem__(self, key: str) -> None:
        del self.__dict__[key]

    def __len__(self) -> int:
        return len(self.__dict__)

    def __iter__(self) -> Iterator[str]:
        return iter(self.__dict__)

    def __getitem__(self, key: str) -> CardImageCollection:
        return self.__dict__[key]

    def keys(self):
        return self.__dict__.keys()

    def __init__(self):
        self.__dict__: Dict[str, CardImageCollection] = {
            Faces.FRONT.value: CardImageCollection(),
            Faces.BACK.value: CardImageCollection(),
        }
        self.cardstock: Cardstocks = Cardstocks.S30
        self.foil = False
        self.cardback = CardbackImage()

    def insert(
        self,
        query: str,
        slots: List[Any],
        face: str,
        req_type: str,
        selected_img: str,
    ):
        # check that the given face is in the order's keys and raise an error if not
        if face not in self.keys():
            raise ValueError(
                f"Specified face not in MPCOrder's faces: you specified {face}, I have {self.keys()}"
            )

        self[face].insert(query, slots, req_type, selected_img)

    def add_to_cardback(self, slots: Set[int]):
        slots_with_ids = {(x, "") for x in slots}
        self.cardback.add_slots(slots_with_ids)

    def set_common_cardback_id(self, slots: Set[Any], selected_img):
        # sets the common cardback's ID and sets the same ID to the given back face slots
        slots.add("-")
        yaboi = [x for x in self.cardback.slots if x[0] in slots]
        [self.cardback.slots.remove(x) for x in yaboi]
        self.cardback.add_slots({(x, selected_img) for x in slots})

    def remove_common_cardback(self):
        # pop the common cardback from the back face's slots
        self.cardback.remove_common_cardback()

    def __str__(self):
        return "\n".join(f"{key} {str(value)}" for key, value in self)

    def to_dict(self):
        ret = {x: self[x].to_dict() for x in Faces.FACES.value}
        ret[Faces.BACK.value][""] = self.cardback.to_dict()

        # in the event of mangled xml's, the following bit of code will repair the front face of the
        # mpc order such that we get empty slots rather than missing cards on the frontend
        used_slots = set()
        for image in self.front:
            used_slots = used_slots.union({x[0] for x in self.front[image].slots})

        if used_slots:
            all_slots = set(range(min(used_slots), max(used_slots) + 1))
            empty_slots = all_slots - used_slots
            if empty_slots:
                ret[Faces.FRONT.value][""] = CardImage(
                    "", {(x, "") for x in empty_slots}, ReqTypes.CARD.value
                ).to_dict()

        # attach the common cardback id in an easy to access place for the frontend
        common_cardback_id = ""
        common_back_in_mpc_order = "false"
        common_back_elem = [x[1] for x in self.cardback.slots if x[0] == "-"]
        if common_back_elem:
            common_cardback_id = common_back_elem[0]
            common_back_in_mpc_order = "true"
        ret["common_cardback"] = {
            "id": common_cardback_id,
            "in_order": common_back_in_mpc_order,
        }

        ret["cardstock"] = self.cardstock.value
        ret["foil"] = "true" if self.foil else "false"

        return ret

    def from_text(self, input_lines: str, offset: int = 0):
        # populates MPCOrder from supplied text input
        transforms = dict((x.front, x.back) for x in DFCPair.objects.all())
        curr_slot = offset

        # loop over lines in the input text, and for each, parse it into usable information
        for line in input_lines.splitlines():
            # extract the query and quantity from the current line of the input text
            (query, qty) = process_line(line)

            if query:
                # cap at 612
                over_cap = False
                if qty + curr_slot >= 612:
                    qty = 612 - curr_slot
                    over_cap = True

                req_type = ""
                curr_slots = set(range(curr_slot, curr_slot + qty))

                # first, determine if this card is a DFC by virtue of it having its two faces separated by an ampersand
                query_faces = [query, ""]
                query_split = [to_searchable(x) for x in query.split(" & ")]
                if len(query_split) > 1:
                    if (
                        query_split[0] in transforms.keys()
                        and query_split[1] in transforms.values()
                    ):
                        query_faces = query_split
                elif query[0:2].lower() == "t:":
                    query_faces[0] = to_searchable(query[2:])
                    req_type = ReqTypes.TOKEN.value
                else:
                    query_faces[0] = to_searchable(query)
                    # gotta check if query is the front of a DFC here as well
                    if query_faces[0] in transforms.keys():
                        query_faces = [query, transforms[query_faces[0]]]

                # stick the front face into the dictionary
                self.insert(query_faces[0], curr_slots, Faces.FRONT.value, req_type, "")

                if query_faces[1]:
                    # is a DFC, gotta add the back face to the correct slots
                    self.insert(
                        query_faces[1], curr_slots, Faces.BACK.value, req_type, ""
                    )

                else:
                    # is not a DFC, so add this card's slots onto the common cardback's slots
                    # self.insert_empty(curr_slots, Faces.BACK.value)
                    self.add_to_cardback(curr_slots)

                curr_slot += qty

                if over_cap:
                    break

        return curr_slot - offset

    def from_csv(self, csv_bytes):
        # populates MPCOrder from supplied CSV bytes
        transforms = dict((x.front, x.back) for x in DFCPair.objects.all())
        # TODO: I'm sure this can be cleaned up a lot, the logic here is confusing and unintuitive
        curr_slot = 0

        # support for different types of encoding - detect the encoding type then decode the given bytes
        # according to that
        csv_format = chardet.detect(csv_bytes)
        csv_string_split = csv_bytes.decode(csv_format["encoding"]).splitlines()

        # handle case where csv doesn't have correct headers
        headers = ",".join(
            [CSVHeaders.QTY.value, CSVHeaders.FRONT.value, CSVHeaders.BACK.value]
        )
        if csv_string_split[0] != headers:
            # this CSV doesn't appear to have the correct column headers, so we'll attach them here
            csv_string_split = [headers] + csv_string_split
        csv_dictreader = csv.DictReader(csv_string_split)

        for line in csv_dictreader:
            qty = line[CSVHeaders.QTY.value]
            if qty:
                # try to parse qty as int
                try:
                    qty = int(qty)
                except ValueError:
                    # invalid qty
                    continue
            else:
                # for empty quantities, assume qty=1
                qty = 1

            # only care about lines with a front specified
            if line[CSVHeaders.FRONT.value]:
                # the slots for this line in the CSV
                curr_slots = set(range(curr_slot, curr_slot + qty))

                query_faces = [
                    line[CSVHeaders.FRONT.value],
                    line[CSVHeaders.BACK.value],
                ]
                req_type_front = ReqTypes.CARD.value
                req_type_back = ReqTypes.CARD.value

                # process the front face as a token if necessary
                if query_faces[0][0:2].lower() == "t:":
                    query_faces[0] = query_faces[0][2:]
                    req_type_front = ReqTypes.TOKEN.value

                if not line[CSVHeaders.BACK.value]:
                    # back face not specified
                    # potentially doing transform things, because a back wasn't specified
                    # first, determine if this card is a DFC by virtue of it having its two faces separated by an &
                    query_split = [
                        to_searchable(x) for x in query_faces[0].split(" & ")
                    ]
                    if len(query_split) > 1:
                        if (
                            query_split[0] in transforms.keys()
                            and query_split[1] in transforms.values()
                        ):
                            query_faces = query_split
                    else:
                        # gotta check if query is the front of a DFC here as well
                        query_faces[0] = to_searchable(query_faces[0])
                        if query_faces[0] in transforms.keys():
                            query_faces = [query_faces[0], transforms[query_faces[0]]]

                else:
                    # both sides specified - process the back face as a token if necessary
                    if query_faces[1][0:2].lower() == "t:":
                        query_faces[1] = query_faces[1][2:]
                        req_type_back = ReqTypes.TOKEN.value

                # ensure everything has been converted to searchable
                query_faces = [to_searchable(x) for x in query_faces]

                # stick the front face into the dictionary
                self.insert(
                    query_faces[0], curr_slots, Faces.FRONT.value, req_type_front, ""
                )

                if query_faces[1]:
                    # is a DFC, gotta add the back face to the correct slots
                    self.insert(
                        query_faces[1], curr_slots, Faces.BACK.value, req_type_back, ""
                    )

                else:
                    # is not a DFC, so add this card's slots onto the common cardback's slots
                    # self.insert_empty(curr_slots, Faces.BACK.value)
                    self.add_to_cardback(curr_slots)

                curr_slot += qty

        # TODO: Read in chunks if big?
        return curr_slot

    def from_xml(self, input_text, offset=0):
        # populates MPCOrder from supplied XML file contents

        # TODO: validate structure of uploaded XML file separately to this logic before proceeding
        # TODO: convert XML to dict or something in this validation?

        # note: this raises an IndexError if you upload an old xml (which doesn't include the search query), and this
        # exception is handled in the view that calls parse_xml
        try:
            root = ET.fromstring(input_text)
        except (ET.ParseError):
            raise ParsingErrors.MalformedXMLException

        # passing cardstock through the Cardstocks enum to validate that the given cardstock is valid
        self.cardstock = {str(x.value): x for x in Cardstocks}[root[0][2].text]
        self.foil = root[0][3].text == "true"

        def xml_parse_face(elem, face, offset):
            # parse a given face of the uploaded xml and add its cards to the mpc order, returning the slot
            # numbers found for this face in the xml
            used_slots = []
            for child in elem:
                # structure: id, slots, name, query
                card_id = child[0].text
                slots = {
                    x + offset for x in text_to_list(child[1].text) if x + offset < 612
                }
                # filter out slot numbers greater than or equal to 612
                # slots = {x for x in slots if x < 612}
                if slots:
                    used_slots += slots
                    query = child[3].text
                    if query:
                        self.insert(query, slots, face, ReqTypes.CARD.value, card_id)
                    else:
                        self.cardback.add_slots({(x, card_id) for x in slots})

            return set(used_slots)

        # parse the fronts first to get a list of slots that are specifically filled in the order
        used_slots = xml_parse_face(root[1], Faces.FRONT.value, offset)

        # figure out which slots are empty in the order
        # calculate qty with the maximum and minimum slot numbers in the order, because there might be
        # missing cards we need to account for - and calculate the range of all slots in the order
        qty = 0
        if used_slots:
            qty = max(used_slots) - min(used_slots) + 1
            all_slots = set(range(min(used_slots), max(used_slots) + 1))

            # for cardbacks, start by assuming all back slots are empty, then if the xml has any back cards,
            # remove those from the set of empty cardback slots
            empty_back_slots = all_slots
            cardback_index = 2
            if root[2].tag == "backs":
                # remove the back slots from used_slots, leaving us with just slots with the common cardback
                empty_back_slots -= xml_parse_face(root[2], Faces.BACK.value, offset)
                cardback_index = 3
            try:
                cardback_id = root[cardback_index].text
            except IndexError:
                raise ParsingErrors.MissingElementException("cardback", cardback_index)

            self.add_to_cardback(empty_back_slots)
            self.set_common_cardback_id(empty_back_slots, cardback_id)

        return qty

    def from_link(self, url: str, offset=0):
        for site in ImportSites:
            site_instance = site()
            if url.startswith(site_instance.base_url):
                return self.from_text(site_instance.retrieve_card_list(url), offset)
        raise ParsingErrors.SiteNotSupportedException(url)

    def from_json(self, order_json):
        # populates MPCOrder from supplied json/dictionary
        self.cardstock = {str(x.value): x for x in Cardstocks}[order_json["cardstock"]]
        self.foil = order_json["foil"] == "true"
        self.remove_common_cardback()
        for face in Faces.FACES.value:
            for key in order_json[face].keys():
                query = order_json[face][key]["query"]
                # slots = order_json[face][key]["slots"]
                slots = {tuple(x) for x in order_json[face][key]["slots"]}
                req_type = order_json[face][key]["req_type"]
                if query:
                    self[face].insert_with_ids(query, slots, req_type)
                else:
                    self.cardback.add_slots(slots)
