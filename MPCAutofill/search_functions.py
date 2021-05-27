import csv

import chardet
import defusedxml.ElementTree as ET

from cardpicker.forms import InputText
from cardpicker.models import Card, Cardback, Token, Source, DFCPair
from to_searchable import to_searchable

from math import floor
from Levenshtein import distance
from django.contrib.postgres.search import SearchQuery


def build_context(drive_order, order, qty):
    # I found myself copy/pasting this between the three input methods so I figured it belonged in its own function

    # For donation modal, approximate how many cards I've rendered
    my_cards = 100 * floor(
        int(Source.objects.get(id="Chilli_Axe").count()[0].replace(",", "")) / 100
    )

    context = {
        "form": InputText,
        "drive_order": drive_order,
        "order": order,
        "qty": qty,
        "my_cards": f"{my_cards :,d}",
    }

    return context


def text_to_list(input_text):
    # Helper function to translate strings like "[2, 4, 5, 6]" into lists
    if input_text == "":
        return []
    return [int(x) for x in input_text.strip("][").replace(" ", "").split(",")]


def query_es_card(drive_order, query):
    return search_database(drive_order, query, Card)


def query_es_cardback():
    # return all cardbacks in the search index
    return [x.to_dict() for x in Cardback.objects.all()]


def query_es_token(drive_order, query):
    return search_database(drive_order, query, Token)


def search_database(drive_order, query, model):
    if query == "":
        return []
    # search through the database for a given query, over the drives specified in drive_orders,
    # using the search index specified in s (this enables reuse of code between Card and Token search functions)
    results = []
    is_emblem_search = model == Token and "emblem" in query
    query_parsed = to_searchable(query)

    hits = [
        x.to_dict()
        for x in model.objects.filter(
            searchq=SearchQuery(query_parsed, search_type="phrase")
        )
    ]
    if not hits:
        return results

    # order the results by best match within priority tiers, grouped by drive_order
    for x in hits:
        x["dist"] = distance(x["searchq"], query_parsed)
    hits.sort(key=lambda x: x["dist"])
    if is_emblem_search:
        for drive in drive_order:
            results += [x for x in hits if x["source"] == drive]
    else:
        for drive in drive_order:
            results += [x for x in hits if x["source"] == drive and x["dist"] < 3]
    return results


def process_line(input_str):
    # Extract the quantity and card name from a given line of the text input
    input_str = str(" ".join([x for x in input_str.split(" ") if x]))
    if input_str.isspace() or len(input_str) == 0:
        return None, None
    num_idx = 0
    input_str = input_str.replace("//", "&")
    while True:
        if num_idx > len(input_str):
            return None, None
        try:
            int(input_str[num_idx])
            num_idx += 1
        except ValueError:
            if num_idx == 0:
                # no number at the start of the line - assume qty 1
                qty = 1
                name = " ".join(input_str.split(" "))
            else:
                # located the break between qty and name
                try:
                    qty = int(input_str[0 : num_idx + 1].lower().replace("x", ""))
                except ValueError:
                    return None, None
                name = " ".join(x for x in input_str[num_idx + 1 :].split(" ") if x)
            return name, qty


class OrderDict:
    # small wrapper for a dictionary so it's easy to insert stuff into the order
    def __init__(self):
        # initialise the dictionary and set up empty entries for front and back faces
        self.order = {
            "front": {
                "": {
                    "slots": [],
                    "req_type": "",
                }
            },
            "back": {
                "": {
                    "slots": [["-", ""]],
                    "req_type": "back",
                }
            },
        }

    def insert(self, query, slots, face, req_type, selected_img):
        # stick a thing into the order dict
        slots_with_id = [[x, selected_img] for x in slots]
        if query not in self.order[face].keys():
            self.order[face][query] = {
                "slots": slots_with_id,
                "req_type": req_type,
            }
        else:
            self.order[face][query]["slots"] += slots_with_id

    def insert_empty(self, slots, face):
        # insert empty slots in the requested face
        # for back face, this will add onto the common cardback's slots
        slots_with_id = [[x, ""] for x in slots]
        self.order[face][""]["slots"] += slots_with_id

    # handy for debugging purposes
    def __str__(self):
        return_str = "printing orderdict:\n"
        for face in ["front", "back"]:
            return_str += face + "s:\n"
            for key in self.order[face].keys():
                return_str += "<{}>: slots <{}>, req_type <{}>\n".format(
                    key,
                    self.order[face][key]["slots"],
                    self.order[face][key]["req_type"],
                )
        return_str += "over and out!"
        return return_str


def parse_text(input_lines, offset=0):
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
                req_type = "token"
            else:
                query_faces[0] = to_searchable(query)
                # gotta check if query is the front of a DFC here as well
                if query_faces[0] in transforms.keys():
                    query_faces = [query, transforms[query_faces[0]]]

            # stick the front face into the dictionary
            cards_dict.insert(query_faces[0], curr_slots, "front", req_type, "")

            if query_faces[1]:
                # is a DFC, gotta add the back face to the correct slots
                cards_dict.insert(query_faces[1], curr_slots, "back", req_type, "")

            else:
                # is not a DFC, so add this card's slots onto the common cardback's slots
                cards_dict.insert_empty(curr_slots, "back")

            curr_slot += qty

            if over_cap:
                break

    return cards_dict.order, curr_slot - offset


def parse_csv(csv_bytes):
    transforms = dict((x.front, x.back) for x in DFCPair.objects.all())
    # TODO: I'm sure this can be cleaned up a lot, the logic here is confusing and unintuitive
    cards_dict = OrderDict()
    curr_slot = 0

    # support for different types of encoding - detect the encoding type then decode the given bytes according to that
    csv_format = chardet.detect(csv_bytes)
    csv_string_split = csv_bytes.decode(csv_format["encoding"]).splitlines()

    # handle case where csv doesn't have correct headers
    headers = "Quantity,Front,Back"
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
            req_type_front = "normal"
            req_type_back = "normal"

            # process the front face as a token if necessary
            if query_faces[0][0:2].lower() == "t:":
                query_faces[0] = query_faces[0][2:]
                req_type_front = "token"

            if not line["Back"]:
                # back face not specified
                # potentially doing transform things, because a back wasn't specified
                # first, determine if this card is a DFC by virtue of it having its two faces separated by an ampersand
                if "&" in query_faces[0]:
                    query_split = [to_searchable(x) for x in query.split(" & ")]
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
                    req_type_back = "token"

            # ensure everything has been converted to searchable
            query_faces = [to_searchable(x) for x in query_faces]

            # stick the front face into the dictionary
            cards_dict.insert(query_faces[0], curr_slots, "front", req_type_front, "")

            if query_faces[1]:
                # is a DFC, gotta add the back face to the correct slots
                cards_dict.insert(query_faces[1], curr_slots, "back", req_type_back, "")

            else:
                # is not a DFC, so add this card's slots onto the common cardback's slots
                cards_dict.insert_empty(curr_slots, "back")

            curr_slot += qty

    # TODO: Read in chunks if big?
    return cards_dict.order, curr_slot


def parse_xml(input_text, offset=0):
    # TODO: gotta set up cardback IDs for cards which use the default cardback
    # TODO: don't include the right panel cardabck in this dict, bc it'll overwrite the cardback they had?

    # note: this raises an IndexError if you upload an old xml (which doesn't include the search query), and this
    # exception is handled in the view that calls parse_xml
    # TODO: handle the exception here and return nothing
    cards_dict = OrderDict()
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
                cards_dict.insert(query, slots, face, "", card_id)

        return set(used_slots)

    # parse the fronts first to get a list of slots that are specifically filled in the order
    used_slots = xml_parse_face(root[1], "front", offset)

    # figure out which slots are empty in the order
    # calculate qty with the maximum and minimum slot numbers in the order, because there might be
    # missing cards we need to account for - and calculate the range of all slots in the order
    qty = max(used_slots) - min(used_slots) + 1
    all_slots = set(range(min(used_slots), max(used_slots) + 1))
    cards_dict.insert_empty(list(all_slots - used_slots), "front")

    # for cardbacks, start by assuming all back slots are empty, then if the xml has any back cards, remove those
    # from the set of empty cardback slots
    empty_back_slots = all_slots
    # cardback_id = ""  # comments left here in case we eventually wanna pass cardback info to the frontend
    if root[2].tag == "backs":
        # remove the back slots from used_slots, leaving us with just slots with the common cardback
        empty_back_slots -= xml_parse_face(root[2], "back", offset)
        # cardback_id = root[3].text
    # else:
    # cardback_id = root[2].text
    cards_dict.insert_empty(list(empty_back_slots), "back")

    return cards_dict.order, qty


def search_new(s, source, page=0):

    # define page size and the range to paginate with
    page_size = 6
    start_idx = page_size * page
    end_idx = page_size * (page + 1)

    # match the given source
    query = s.filter(source=source)

    # quantity related things
    qty = query.count()
    results = {"qty": qty}
    if qty > 0:
        # retrieve a page's worth of hits, and convert the results to dict for ez parsing in frontend
        hits = query[start_idx:end_idx]
        results0 = [x.to_dict() for x in hits]
        results["hits"] = [x for x in results0]

    # let the frontend know whether to continue to show the load more button
    # TODO: I couldn't be fucked to solve true vs True for json serialisation but this works fine so eh?
    results["more"] = "false"
    if qty > end_idx:
        results["more"] = "true"

    return results
