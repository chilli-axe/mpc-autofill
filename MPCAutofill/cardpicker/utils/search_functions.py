import csv

import chardet
import defusedxml.ElementTree as ET

from cardpicker.documents import CardSearch, CardbackSearch, TokenSearch
from cardpicker.forms import InputText
from cardpicker.models import Source
from cardpicker.utils.to_searchable import to_searchable

from elasticsearch_dsl.query import Match

from math import floor
from Levenshtein import distance

from datetime import timedelta
from django.utils import timezone


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
    return search_database(drive_order, query, CardSearch.search())


def query_es_cardback():
    # return all cardbacks in the search index
    s = CardbackSearch.search()
    hits = s.sort({"priority": {"order": "desc"}}).params(preserve_order=True).scan()
    results = [x.to_dict() for x in hits]
    return results


def query_es_token(drive_order, query):
    return search_database(drive_order, query, TokenSearch.search())


def search_database(drive_order, query, s):
    # search through the database for a given query, over the drives specified in drive_orders,
    # using the search index specified in s (this enables reuse of code between Card and Token search functions)
    results = []

    query_parsed = to_searchable(query)

    # set up search - match the query and use the AND operator
    match = Match(searchq={"query": query_parsed, "operator": "AND"})
    s_query = s.query(match)
    hits = (
        s_query.sort({"priority": {"order": "desc"}}).params(preserve_order=True).scan()
    )
    hits_dict = [x.to_dict() for x in hits]

    if hits_dict:
        hits_dict.sort(key=lambda x: distance(x["searchq"], query_parsed))
        for drive in drive_order:
            results += [x for x in hits_dict if x["source"] == drive]

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


def search_new_elasticsearch_definition():
    days = 14
    dt_from = timezone.now() - timedelta(days=days)
    dt_to = timezone.now()
    return CardSearch().search().filter("range", date={"from": dt_from, "to": dt_to})


def search_new(s, source, page=0):
    # define page size and the range to paginate with
    page_size = 6
    start_idx = page_size * page
    end_idx = page_size * (page + 1)

    # match the given source
    query = s.filter("match", source=source).sort({"date": {"order": "desc"}})

    # quantity related things
    qty = query.count()
    results = {"qty": qty}
    if qty > 0:
        # retrieve a page's worth of hits, and convert the results to dict for ez parsing in frontend
        results["hits"] = [x.to_dict() for x in query[start_idx:end_idx]]

    # let the frontend know whether to continue to show the load more button
    # TODO: I couldn't be fucked to solve true vs True for json serialisation but this works fine so eh?
    results["more"] = "false"
    if qty > end_idx:
        results["more"] = "true"

    return results
