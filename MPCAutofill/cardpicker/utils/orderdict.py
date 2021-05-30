"""
Object Model for working with OrderDicts - the data structure that defines a user's card order
"""

import chardet
import csv
import defusedxml.ElementTree as ET

from typing import Any, Tuple, List, Dict
from enum import Enum

from cardpicker.models import DFCPair
from cardpicker.utils.search_functions import process_line, text_to_list
from cardpicker.utils.to_searchable import to_searchable


class ReqTypes(Enum):
    CARD = ""
    TOKEN = "token"
    CARDBACK = "back"  # TODO: or "cardback"?


class Faces(Enum):
    FRONT = "front"
    BACK = "back"
    FACES = [FRONT, BACK]


class CardImage:
    def __init__(self, query: str, slots: List[Tuple[Any, str]], req_type: str):
        self.query = query
        self.slots = (
            slots  # slots is a list of tuples where each tuple is (slot, image id)
        )
        self.req_type = req_type

    def add_slots(self, new_slots: List[Tuple[Any, str]]):
        self.slots += new_slots

    def remove_common_cardback(self):
        if "-" in [x[0] for x in self.slots]:
            self.slots.pop(
                0
            )  # TODO: naive to assume that it's the first element in the list?

    def __str__(self):
        return f"'{self.query}': '{self.req_type}', with slots:\n    {self.slots}"

    def to_dict(self):
        return {
            "query": self.query,
            "slots": [list(x) for x in self.slots],
            "req_type": self.req_type,
        }


class CardImageCollection:
    def __init__(self):
        self.card_images: Dict[str, CardImage] = {}

    def insert(self, query: str, slots: List[Any], req_type: str, selected_img: str):
        slots_with_id = [(x, selected_img) for x in slots]
        # create a CardImage and insert into the dictionary
        if query not in self.card_images.keys():
            self.card_images[query] = CardImage(query, slots_with_id, req_type)
        else:
            # update the CardImage with the given query with more slots
            self.card_images[query].add_slots(slots_with_id)

    def insert_empty(self, slots):
        # insert empty slots in the requested face
        # for back face, this will add onto the common cardback's slots
        slots_with_id = [(x, "") for x in slots]
        self.card_images[""].add_slots(slots_with_id)

    def __str__(self):
        return f"contains the following:\n" + "\n".join(
            str(x) for x in self.card_images.values()
        )

    def to_dict(self):
        return {key: value.to_dict() for key, value in self.card_images.items()}


class OrderDict:
    def __init__(self):
        self.order: Dict[str, CardImageCollection] = {
            Faces.FRONT.value: CardImageCollection(),
            Faces.BACK.value: CardImageCollection(),
        }

        # TODO: the original OrderDict class inserted an empty element into the front face
        # can't remember why though and it seems to break things - will revisit
        # self.order[Faces.FRONT.value].insert("", [""], ReqTypes.CARD.value, ReqTypes.CARD.value)
        self.order[Faces.BACK.value].insert("", ["-"], ReqTypes.CARDBACK.value, "")

    def insert(
        self,
        query: str,
        slots: List[Tuple[Any, str]],
        face: str,
        req_type: str,
        selected_img: str,
    ):
        # check that the given face is in the order's keys and raise an error if not
        if face not in self.order.keys():
            raise ValueError(
                f"Specified face not in OrderDict's faces: you specified {face}, I have {self.order.keys()}"
            )

        self.order[face].insert(query, slots, req_type, selected_img)

    def insert_empty(self, slots: List[Tuple[Any, str]], face: str):
        # check that the given face is in the order's keys and raise an error if not
        if face not in self.order.keys():
            raise ValueError(
                f"Specified face not in OrderDict's faces: you specified {face}, I have {self.order.keys()}"
            )

        self.order[face].insert_empty(slots)

    def remove_common_cardback(self):
        # pop the common cardback from the back face's slots
        self.order[Faces.BACK.value].card_images[""].remove_common_cardback()

    def __str__(self):
        return "\n".join(f"{key} {str(value)}" for key, value in self.order)

    def to_dict(self):
        return {x: self.order[x].to_dict() for x in Faces.FACES.value}

    def from_text(self, input_lines: str, offset: int = 0):
        transforms = dict((x.front, x.back) for x in DFCPair.objects.all())
        cards_dict = OrderDict()

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
                curr_slots = list(range(curr_slot, curr_slot + qty))

                # first, determine if this card is a DFC by virtue of it having its two faces separated by an ampersand
                query_faces = [query, ""]
                if "&" in query_faces[0]:
                    query_split = [to_searchable(x) for x in query.split(" & ")]
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
                    self.insert_empty(curr_slots, Faces.BACK.value)

                curr_slot += qty

                if over_cap:
                    break

        return curr_slot - offset

    def from_csv(self, csv_bytes):
        transforms = dict((x.front, x.back) for x in DFCPair.objects.all())
        # TODO: I'm sure this can be cleaned up a lot, the logic here is confusing and unintuitive
        curr_slot = 0

        # support for different types of encoding - detect the encoding type then decode the given bytes
        # according to that
        csv_format = chardet.detect(csv_bytes)
        csv_string_split = csv_bytes.decode(csv_format["encoding"]).splitlines()

        # handle case where csv doesn't have correct headers
        headers = "Quantity,Front,Back"  # TODO: constants for CSV headers
        if csv_string_split[0] != headers:
            # this CSV doesn't appear to have the correct column headers, so we'll attach them here
            csv_string_split = [headers] + csv_string_split
        csv_dictreader = csv.DictReader(csv_string_split)

        for line in csv_dictreader:
            qty = line["Quantity"]
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
            if line["Front"]:
                # the slots for this line in the CSV
                curr_slots = list(range(curr_slot, curr_slot + qty))

                query_faces = [line["Front"], line["Back"]]
                req_type_front = ReqTypes.CARD.value
                req_type_back = ReqTypes.CARD.value

                # process the front face as a token if necessary
                if query_faces[0][0:2].lower() == "t:":
                    query_faces[0] = query_faces[0][2:]
                    req_type_front = ReqTypes.TOKEN.value

                if not line["Back"]:
                    # back face not specified
                    # potentially doing transform things, because a back wasn't specified
                    # first, determine if this card is a DFC by virtue of it having its two faces separated by an &
                    if "&" in query_faces[0]:
                        query_split = [
                            to_searchable(x) for x in query_faces[0].split(" & ")
                        ]  # TODO: check, query_faces[0] was query (undefined)
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
                    self.insert_empty(curr_slots, Faces.BACK.value)

                curr_slot += qty

        # TODO: Read in chunks if big?
        return curr_slot

    def from_xml(self, input_text, offset=0):
        # TODO: gotta set up cardback IDs for cards which use the default cardback
        # TODO: don't include the right panel back in this dict, bc it'll overwrite the cardback they had?

        # note: this raises an IndexError if you upload an old xml (which doesn't include the search query), and this
        # exception is handled in the view that calls parse_xml
        # TODO: handle the exception here and return nothing
        root = ET.fromstring(input_text)

        def xml_parse_face(elem, face, offset):
            # parse a given face of the uploaded xml and add its cards to the orderdict, returning the slot
            # numbers found for this face in the xml
            used_slots = []
            for child in elem:
                # structure: id, slots, name, query
                card_id = child[0].text
                slots = [x + offset for x in text_to_list(child[1].text)]
                # filter out slot numbers greater than or equal to 612
                slots = [x for x in slots if x < 612]
                if slots:
                    used_slots += slots
                    query = child[3].text
                    self.insert(query, slots, face, ReqTypes.CARD.value, card_id)

            return set(used_slots)

        # parse the fronts first to get a list of slots that are specifically filled in the order
        used_slots = xml_parse_face(root[1], Faces.FRONT.value, offset)

        # figure out which slots are empty in the order
        # calculate qty with the maximum and minimum slot numbers in the order, because there might be
        # missing cards we need to account for - and calculate the range of all slots in the order
        qty = max(used_slots) - min(used_slots) + 1
        all_slots = set(range(min(used_slots), max(used_slots) + 1))
        self.insert_empty(list(all_slots - used_slots), Faces.FRONT.value)

        # for cardbacks, start by assuming all back slots are empty, then if the xml has any back cards, remove those
        # from the set of empty cardback slots
        empty_back_slots = all_slots
        # cardback_id = ""  # comments left here in case we eventually wanna pass cardback info to the frontend
        if root[2].tag == "backs":
            # remove the back slots from used_slots, leaving us with just slots with the common cardback
            empty_back_slots -= xml_parse_face(root[2], Faces.BACK.value, offset)
            # cardback_id = root[3].text
        # else:
        # cardback_id = root[2].text
        self.insert_empty(list(empty_back_slots), Faces.BACK.value)

        return qty

    # TODO: from_json method (for database storage)
