"""
Object Model for working with MPCOrders - the data structure that defines a user's card order
TODO: is it possible to refactor this and the desktop tool's data structures for reuse between them?
"""

import csv
from collections import abc
from enum import Enum
from typing import Any, ItemsView, Iterator, KeysView, Optional, Union, ValuesView
from xml.etree.ElementTree import Element

import chardet
import defusedxml.ElementTree as ET

from cardpicker.models import DFCPair
from cardpicker.utils import process_line, text_to_list, to_searchable
from cardpicker.utils.link_imports import ImportSites


class ParsingErrors:
    class MalformedXMLException(Exception):
        def __init__(self) -> None:
            self.message = "The input XML file contained a syntax error."
            super().__init__(self.message)

    class MissingElementException(Exception):
        def __init__(self, element: str, index: int) -> None:
            self.message = (
                f"Your XML file wasn't structured correctly. The {element} element was expected at index {index}."
            )
            super().__init__(self.message)

    class SiteNotSupportedException(Exception):
        def __init__(self, url: str) -> None:
            self.message = f"Importing card lists from {url} is not supported. Sorry about that!"
            super().__init__(self.message)


# TODO: move these constants to a `constants` module at the root of the repo to share between django project and desktop tool
class Cardstocks(str, Enum):
    S30 = "(S30) Standard Smooth"
    S33 = "(S33) Superior Smooth"
    M31 = "(M31) Linen"
    P10 = "(P10) Plastic"


class ReqTypes(str, Enum):
    CARD = ""
    TOKEN = "token"
    CARDBACK = "back"


class Faces(str, Enum):
    FRONT = "front"
    BACK = "back"

    @classmethod
    def get_faces(cls) -> list[str]:
        return [cls.FRONT.value, cls.BACK.value]


class CSVHeaders(str, Enum):
    FRONT = "Front"
    BACK = "Back"
    QTY = "Quantity"


class CardImage:
    def __init__(self, query: Optional[str], slots: set[tuple[Any, str]], req_type: ReqTypes):
        self.query = query if query is not None else ""
        self.slots = slots  # slots is a set of tuples where each tuple is (slot, image id)
        self.req_type = req_type
        self.data: list[dict[str, Any]] = []

    def add_slots(self, new_slots: set[tuple[Union[int, str], str]]) -> None:
        self.slots |= new_slots

    def insert_data(self, results: dict[str, Any]) -> None:
        # search results data - populated in ajax callbacks
        self.data = results["data"]
        self.query = results["query"]
        self.req_type = results["req_type"]

    def __str__(self) -> str:
        return f"'{self.query}': '{self.req_type}', with slots:\n    {self.slots}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "slots": [list(x) for x in self.slots],
            "req_type": self.req_type.value,
            "data": self.data,
        }


class CardbackImage(CardImage):
    def __init__(self) -> None:
        super(CardbackImage, self).__init__("", {("-", "")}, ReqTypes.CARDBACK)

    def remove_common_cardback(self) -> None:
        common_cardback_elem = [x for x in self.slots if x[0] == "-"]
        if common_cardback_elem:
            self.slots.remove(common_cardback_elem[0])


class CardImageCollection(abc.MutableMapping[str, Any]):
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

    def keys(self) -> KeysView[str]:
        return self.__dict__.keys()

    def values(self) -> ValuesView[CardImage]:
        return self.__dict__.values()

    def items(self) -> ItemsView[str, CardImage]:
        return self.__dict__.items()

    def __init__(self, dict_: Optional[dict[str, CardImage]] = None) -> None:
        self.__dict__: dict[str, CardImage] = dict_ or {}

    def insert_with_ids(self, query: str, slots: set[tuple[Any, str]], req_type: ReqTypes) -> None:
        # TODO: the naming of this method is confusing
        # create a CardImage and insert into the dictionary
        if query not in self.keys():
            self[query] = CardImage(query, slots, req_type)
        else:
            # update the CardImage with the given query with more slots
            self[query].add_slots(slots)

    def insert(self, query: str, slots: set[Union[int, str]], req_type: ReqTypes, selected_img: str) -> None:
        slots_with_id = {(x, selected_img) for x in slots}
        self.insert_with_ids(query, slots_with_id, req_type)

    def __str__(self) -> str:
        return "contains the following:\n" + "\n".join(str(x) for x in self.values())

    def to_dict(self) -> dict[str, Any]:
        return {key: value.to_dict() for key, value in self.items()}


class MPCOrder(abc.MutableMapping[str, Any]):
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

    def keys(self) -> KeysView[str]:
        return self.__dict__.keys()

    def __init__(
        self,
        fronts: Optional[CardImageCollection] = None,
        backs: Optional[CardImageCollection] = None,
        cardstock: Cardstocks = Cardstocks.S30,
        foil: bool = False,
        cardback: Optional[CardbackImage] = None,
    ) -> None:
        self.__dict__: dict[str, CardImageCollection] = {
            Faces.FRONT.value: fronts or CardImageCollection(),
            Faces.BACK.value: backs or CardImageCollection(),
        }
        self.cardstock: Cardstocks = cardstock
        self.foil = foil
        self.cardback = cardback or CardbackImage()

    def insert(self, query: str, slots: set[Union[int, str]], face: str, req_type: ReqTypes, selected_img: str) -> None:
        # check that the given face is in the order's keys and raise an error if not
        if face not in self.keys():
            raise ValueError(f"Specified face not in MPCOrder's faces: you specified {face}, I have {self.keys()}")

        self[face].insert(query, slots, req_type, selected_img)

    def add_to_cardback(self, slots: set[Union[int, str]]) -> None:
        slots_with_ids = {(x, "") for x in slots}
        self.cardback.add_slots(slots_with_ids)

    def set_common_cardback_id(self, slots: set[Union[int, str]], selected_img: str) -> None:
        # sets the common cardback's ID and sets the same ID to the given back face slots
        slots.add("-")
        slots_to_remove = [x for x in self.cardback.slots if x[0] in slots]
        for slot in slots_to_remove:
            self.cardback.slots.remove(slot)
        self.cardback.add_slots({(x, selected_img) for x in slots})

    def remove_common_cardback(self) -> None:
        # pop the common cardback from the back face's slots
        self.cardback.remove_common_cardback()

    def __str__(self) -> str:
        return "\n".join(f"{key} {str(value)}" for key, value in self.items())

    def to_dict(self) -> dict[str, Union[str, dict[str, Any]]]:
        ret: dict[str, Union[str, dict[str, Any]]] = {x: self[x].to_dict() for x in Faces.get_faces()}
        ret[Faces.BACK.value][""] = self.cardback.to_dict()  # type: ignore

        # in the event of mangled xml's, the following bit of code will repair the front face of the
        # mpc order such that we get empty slots rather than missing cards on the frontend
        used_slots: set[int] = set()
        for image in self[Faces.FRONT.value]:
            used_slots = used_slots.union({x[0] for x in self[Faces.FRONT.value][image].slots})

        if used_slots:
            all_slots = set(range(min(used_slots), max(used_slots) + 1))
            empty_slots = all_slots - used_slots
            if empty_slots:
                empty_card_image = CardImage("", {(x, "") for x in empty_slots}, ReqTypes.CARD)
                ret[Faces.FRONT.value][""] = empty_card_image.to_dict()  # type: ignore

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

    def from_text(self, input_lines: str, offset: int = 0) -> int:
        # TODO: update naming for clarity, add docstring, etc.
        # populates MPCOrder from supplied text input
        transforms = dict((x.front_searchable, x.back_searchable) for x in DFCPair.objects.all())
        curr_slot = offset

        # loop over lines in the input text, and for each, parse it into usable information
        for line in input_lines.splitlines():
            # extract the query and quantity from the current line of the input text
            query, qty = process_line(line)

            if query is not None and qty is not None:
                # cap at 612
                over_cap = False
                if qty + curr_slot >= 612:
                    qty = 612 - curr_slot
                    over_cap = True

                req_type = ReqTypes.CARD
                curr_slots: set[Union[int, str]] = set(range(curr_slot, curr_slot + qty))

                # first, determine if this card is a DFC by virtue of it having its two faces separated by an ampersand
                query_faces = [query, ""]
                query_split = [to_searchable(x) for x in query.split(" & ")]
                if len(query_split) > 1:
                    if query_split[0] in transforms.keys() and query_split[1] in transforms.values():
                        query_faces = query_split
                elif query[0:2].lower() == "t:":
                    query_faces[0] = to_searchable(query[2:])
                    req_type = ReqTypes.TOKEN
                else:
                    query_faces[0] = to_searchable(query)
                    # gotta check if query is the front of a DFC here as well
                    if query_faces[0] in transforms.keys():
                        query_faces = [query_faces[0], transforms[query_faces[0]]]

                # stick the front face into the dictionary
                self.insert(query_faces[0], curr_slots, Faces.FRONT.value, req_type, "")

                if query_faces[1]:
                    # is a DFC, gotta add the back face to the correct slots
                    self.insert(query_faces[1], curr_slots, Faces.BACK.value, req_type, "")

                else:
                    # is not a DFC, so add this card's slots onto the common cardback's slots
                    # self.insert_empty(curr_slots, Faces.BACK.value)
                    self.add_to_cardback(curr_slots)

                curr_slot += qty

                if over_cap:
                    break

        return curr_slot - offset

    def from_csv(self, csv_bytes: bytes) -> int:
        # TODO: as above, these return integer length of the cards added to the order (I think)
        # populates MPCOrder from supplied CSV bytes
        transforms = dict((x.front_searchable, x.back_searchable) for x in DFCPair.objects.all())
        # TODO: I'm sure this can be cleaned up a lot, the logic here is confusing and unintuitive
        curr_slot = 0

        # support for different types of encoding - detect the encoding type then decode the given bytes
        # according to that
        csv_format = chardet.detect(csv_bytes)
        csv_string_split = csv_bytes.decode(csv_format["encoding"]).splitlines()

        # handle case where csv doesn't have correct headers
        headers = ",".join([CSVHeaders.QTY.value, CSVHeaders.FRONT.value, CSVHeaders.BACK.value])
        if csv_string_split[0] != headers:
            # this CSV doesn't appear to have the correct column headers, so we'll attach them here
            csv_string_split = [headers] + csv_string_split
        csv_dictreader = csv.DictReader(csv_string_split)

        for line in csv_dictreader:
            qty_string = line[CSVHeaders.QTY.value]
            if qty_string:
                # try to parse qty as int
                try:
                    qty = int(qty_string)
                except ValueError:
                    # invalid qty
                    continue
            else:
                # for empty quantities, assume qty=1
                qty = 1

            # only care about lines with a front specified
            if line[CSVHeaders.FRONT.value]:
                # the slots for this line in the CSV
                curr_slots: set[Union[int, str]] = set(range(curr_slot, curr_slot + qty))

                query_faces = [line[CSVHeaders.FRONT.value], line[CSVHeaders.BACK.value]]
                req_type_front = ReqTypes.CARD
                req_type_back = ReqTypes.CARD

                # process the front face as a token if necessary
                if query_faces[0][0:2].lower() == "t:":
                    query_faces[0] = query_faces[0][2:]
                    req_type_front = ReqTypes.TOKEN

                if not line[CSVHeaders.BACK.value]:
                    # back face not specified
                    # potentially doing transform things, because a back wasn't specified
                    # first, determine if this card is a DFC by virtue of it having its two faces separated by an &
                    query_split = [to_searchable(x) for x in query_faces[0].split(" & ")]
                    if len(query_split) > 1:
                        if query_split[0] in transforms.keys() and query_split[1] in transforms.values():
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
                        req_type_back = ReqTypes.TOKEN

                # ensure everything has been converted to searchable
                query_faces = [to_searchable(x) for x in query_faces]

                # stick the front face into the dictionary
                self.insert(query_faces[0], curr_slots, Faces.FRONT.value, req_type_front, "")

                if query_faces[1]:
                    # is a DFC, gotta add the back face to the correct slots
                    self.insert(query_faces[1], curr_slots, Faces.BACK.value, req_type_back, "")

                else:
                    # is not a DFC, so add this card's slots onto the common cardback's slots
                    # self.insert_empty(curr_slots, Faces.BACK.value)
                    self.add_to_cardback(curr_slots)

                curr_slot += qty

        # TODO: Read in chunks if big?
        return curr_slot

    def from_xml(self, input_text: str, offset: int = 0) -> int:
        # populates MPCOrder from supplied XML file contents

        # TODO: validate structure of uploaded XML file separately to this logic before proceeding
        # TODO: convert XML to dict or something in this validation?

        # note: this raises an IndexError if you upload an old xml (which doesn't include the search query), and this
        # exception is handled in the view that calls parse_xml
        try:
            root = ET.fromstring(input_text)
        except ET.ParseError:
            raise ParsingErrors.MalformedXMLException

        # passing cardstock through the Cardstocks enum to validate that the given cardstock is valid
        self.cardstock = {str(x.value): x for x in Cardstocks}[root[0][2].text]
        self.foil = root[0][3].text == "true"

        def xml_parse_face(
            elem: Element, face: str
        ) -> set[Union[int, str]]:  # TODO: test the removal of the `offset` argument
            # parse a given face of the uploaded xml and add its cards to the mpc order, returning the slot
            # numbers found for this face in the xml
            used_slots: set[Union[int, str]] = set()
            for child in elem:
                # structure: id, slots, name, query
                card_id = child[0].text or ""
                # TODO: define max order size in constants
                slots: set[Union[int, str]] = {
                    x + offset for x in text_to_list(child[1].text or "") if x + offset < 612
                }
                # filter out slot numbers greater than or equal to 612
                # slots = {x for x in slots if x < 612}
                if slots:
                    used_slots |= slots
                    query = child[3].text
                    if query:
                        self.insert(query, slots, face, ReqTypes.CARD, card_id)
                    else:
                        self.cardback.add_slots({(int(x), card_id) for x in slots})

            return used_slots

        # parse the fronts first to get a list of slots that are specifically filled in the order
        face_used_slots = xml_parse_face(root[1], Faces.FRONT.value)

        # figure out which slots are empty in the order
        # calculate qty with the maximum and minimum slot numbers in the order, because there might be
        # missing cards we need to account for - and calculate the range of all slots in the order
        qty = 0
        if face_used_slots:
            integer_slots: set[int] = set(filter(lambda x: isinstance(x, int), face_used_slots))  # type: ignore
            max_slot = max(integer_slots)
            min_slot = min(integer_slots)
            qty = max_slot - min_slot + 1
            all_slots: set[Union[int, str]] = set(range(min_slot, max_slot + 1))

            # for cardbacks, start by assuming all back slots are empty, then if the xml has any back cards,
            # remove those from the set of empty cardback slots
            empty_back_slots = all_slots
            cardback_index = 2
            if root[2].tag == "backs":
                # remove the back slots from used_slots, leaving us with just slots with the common cardback
                empty_back_slots -= xml_parse_face(root[2], Faces.BACK.value)
                cardback_index = 3
            try:
                cardback_id = root[cardback_index].text
            except IndexError:
                raise ParsingErrors.MissingElementException("cardback", cardback_index)

            self.add_to_cardback(empty_back_slots)
            self.set_common_cardback_id(empty_back_slots, cardback_id)

        return qty

    def from_link(self, url: str, offset: int = 0) -> int:
        for site in ImportSites:
            if url.startswith(site.get_base_url()):
                return self.from_text(site.retrieve_card_list(url), offset)
        raise ParsingErrors.SiteNotSupportedException(url)

    def from_json(self, order_json: dict[str, Any]) -> None:
        # TODO: update method name to indicate that this updates in-place rather than returning an instance
        # populates MPCOrder from supplied json/dictionary
        self.cardstock = {str(x.value): x for x in Cardstocks}[order_json["cardstock"]]
        self.foil = order_json["foil"] == "true"
        self.remove_common_cardback()
        for face in Faces.get_faces():
            for key in order_json[face].keys():
                query = order_json[face][key]["query"]
                slots = {(x[0], x[1]) for x in order_json[face][key]["slots"]}
                req_type = ReqTypes.CARD
                if req_type_string := order_json[face][key]["req_type"]:
                    req_type = ReqTypes(req_type_string)
                if query:
                    self[face].insert_with_ids(query, slots, req_type)
                else:
                    self.cardback.add_slots(slots)
