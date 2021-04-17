import csv
import math

import chardet
import defusedxml.ElementTree as ET
from elasticsearch_dsl.query import Match

from cardpicker.documents import CardSearch, CardbackSearch, TokenSearch
from cardpicker.forms import InputText
from cardpicker.models import Card, Source, DFCPair
from to_searchable import to_searchable

from django.core import serializers


# Retrieve DFC pairs from database
transforms = dict((x.front, x.back) for x in DFCPair.objects.all())


def build_context(drive_order, order, qty):
    # I found myself copy/pasting this between the three input methods so I figured it belonged in its own function

    # For donation modal, approximate how many cards I've rendered
    my_cards = Source.objects.get(id="Chilli_Axe").count()[0]

    context = {
        "form": InputText,
        "drive_order": drive_order,
        "order": order,
        "qty": qty,
        "my_cards": my_cards,
    }

    return context


def text_to_list(input_text):
    # Helper function to translate strings like "[2, 4, 5, 6]" into lists
    if input_text == "":
        return []
    return [int(x) for x in input_text.strip('][').replace(" ", "").split(',')]


def query_es_card(drive_order, query):
    return search_database(drive_order, query, CardSearch.search())


def query_es_cardback():
    # return all cardbacks in the search index
    s = CardbackSearch.search()
    hits = s \
        .sort({'priority': {'order': 'desc'}}) \
        .params(preserve_order=True) \
        .scan()
    results = [x.to_dict() for x in hits]
    return results


def query_es_token(drive_order, query):
    return search_database(drive_order, query, TokenSearch.search())


def search_database(drive_order, query, s):
    # TODO: elasticsearch_dsl.serializer.serializer ?
    # search through the database for a given query, over the drives specified in drive_orders,
    # using the search index specified in s (this enables reuse of code between Card and Token search functions)

    results = []

    # set up search - match the query and use the AND operator
    match = Match(searchq={"query": to_searchable(query), "operator": "AND"})

    # match the cardname once instead of for every drive to save on search time
    s_query = s.query(match)

    # iterate over drives, filtering on the current drive, ordering by priority in descending order,
    # then add the returned hits to the results list
    hits = s_query.sort({'priority': {'order': 'desc'}}).params(preserve_order=True).scan()
    
    results0 = [x.to_dict() for x in hits]
    for drive in drive_order:
        results += [x for x in results0 if x['source'] == drive]

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
                    qty = int(input_str[0:num_idx + 1].lower().replace("x", ""))
                except ValueError:
                    return None, None
                name = " ".join(x for x in input_str[num_idx + 1:].split(" ") if x)
            return name, qty


class OrderDict:
    # small wrapper for a dictionary so it's easy to insert stuff into the order
    def __init__(self):
        # initialise the dictionary and set up the cardback's entry
        # self.order = {"": {
        self.order = {"front": {}, "back": {
            "": {
                "slots": [["-", ""]],
                "req_type": "back",
            }
        }}

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

    def insert_back(self, slots):
        # add onto the common cardback's slots
        slots_with_id = [[x, ""] for x in slots]
        self.order["back"][""]["slots"] += slots_with_id


def parse_text(input_lines, offset=0):
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
            if '&' in query_faces[0]:
                query_split = [to_searchable(x) for x in query.split(" & ")]
                if query_split[0] in transforms.keys() and query_split[1] in transforms.values():
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
                cards_dict.insert_back(curr_slots)

            curr_slot += qty

            if over_cap:
                break

    return cards_dict.order, curr_slot - offset


def parse_csv(csv_bytes):
    # TODO: I'm sure this can be cleaned up a lot, the logic here is confusing and unintuitive
    cards_dict = OrderDict()
    curr_slot = 0

    # support for different types of encoding - detect the encoding type then decode the given bytes according to that
    csv_format = chardet.detect(csv_bytes)
    csv_string_split = csv_bytes.decode(csv_format['encoding']).splitlines()

    # handle case where csv doesn't have correct headers
    headers = 'Quantity,Front,Back'
    if csv_string_split[0] != headers:
        # this CSV doesn't appear to have the correct column headers, so we'll attach them here
        csv_string_split = [headers] + csv_string_split
    csv_dictreader = csv.DictReader(csv_string_split)

    for line in csv_dictreader:
        qty = line['Quantity']
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
        if line['Front']:
            # the slots for this line in the CSV
            curr_slots = list(range(curr_slot, curr_slot + qty))

            query_faces = [line['Front'], line['Back']]
            req_type_front = "normal"
            req_type_back = "normal"

            # process the front face as a token if necessary
            if query_faces[0][0:2].lower() == "t:":
                query_faces[0] = query_faces[0][2:]
                req_type_front = "token"

            if not line['Back']:
                # back face not specified
                # potentially doing transform things, because a back wasn't specified
                # first, determine if this card is a DFC by virtue of it having its two faces separated by an ampersand
                if '&' in query_faces[0]:
                    query_split = [to_searchable(x) for x in query.split(" & ")]
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
                cards_dict.insert_back(curr_slots)

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

    qty = 0  # should be qty = 0 but was qty = offset?
    root = ET.fromstring(input_text)

    # TODO this might be kinda shit, idk, come back to it later

    def xml_parse_face(elem, face):
        print(elem)
        all_slots = []
        for child in elem:
            # structure: id, slots, name, query
            card_id = child[0].text
            slots = [x + offset for x in text_to_list(child[1].text)]
            # filter out slot numbers greater than or equal to 612
            slots = [x for x in slots if x < 612]
            if slots:
                all_slots += slots
                query = child[3].text
                cards_dict.insert(query, slots, face, "", card_id)

        return set(all_slots)

    # parse the fronts first to get a list of slots in the order
    all_slots = xml_parse_face(root[1], "front")
    # count how many slots we have for qty
    qty = len(all_slots)
    if root[2].tag == "backs":
        # remove the back slots from all_slots, leaving us with just slots with the common cardback
        all_slots -= xml_parse_face(root[2], "back")

    cards_dict.insert_back(list(all_slots))

    return cards_dict.order, qty

def search_new(s, source, page=0):

    # define page size and the range to paginate with
    page_size = 6
    start_idx = page_size*page
    end_idx = page_size*(page+1)
    
    # match the given source
    match = Match(source={"query": source})
    s_query = s.query(match)

    # quantity related things
    qty = s_query.count()
    results = {"qty": qty}
    if qty > 0:
        # results["hits"] = serializers.serialize('json', s_query[start_idx:end_idx].to_queryset())
        # retrieve a page's worth of hits, and convert the results to dict for ez parsing in frontend
        hits = s_query[start_idx:end_idx]
        results0 = [x.to_dict() for x in hits]
        results["hits"] = [x for x in results0]

    # let the frontend know whether to continue to show the load more button
    # TODO: I couldn't be fucked to solve true vs True for json serialisation but this works fine so eh?
    results["more"] = "false"
    if qty > end_idx:
        results["more"] = "true"

    return results