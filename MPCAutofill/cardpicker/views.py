import json
import re
import time
from collections import defaultdict
from datetime import timedelta
from random import choices, randint
from typing import Any, Callable, Optional, TypeVar, Union, cast

from blog.models import BlogPost

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from cardpicker.forms import InputCSV, InputLink, InputText, InputXML
from cardpicker.models import Card, CardTypes, DFCPair, Source, summarise_contributions
from cardpicker.mpcorder import Faces, MPCOrder, ReqTypes
from cardpicker.utils.link_imports import ImportSites
from cardpicker.utils.sanitisation import to_searchable
from cardpicker.utils.search_functions import (
    SearchExceptions,
    SearchQuery,
    SearchSettings,
    build_context,
    ping_elasticsearch,
    query_es_card,
    query_es_cardback,
    query_es_token,
    retrieve_search_settings,
    search_new,
    search_new_elasticsearch_definition,
)

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


class ErrorWrappers:
    """
    View function decorators which gracefully handle exceptions and allow the exception message to be displayed
    to the user.
    """

    @staticmethod
    def to_index(func: F) -> F:
        def wrapper(*args: Any, **kwargs: Any) -> Union[F, HttpResponse]:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                kwargs["exception"] = e.args[0]  # TODO: validate
                return index(*args, **kwargs)

        return cast(F, wrapper)

    @staticmethod
    def to_json(func: F) -> F:
        def wrapper(*args: Any, **kwargs: Any) -> Union[F, HttpResponse]:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                return JsonResponse({"exception": str(e)})

        return cast(F, wrapper)


def index(request: HttpRequest, exception: Optional[str] = None) -> HttpResponse:
    posts = [x.get_synopsis() for x in BlogPost.objects.filter(date_created__gte=timezone.now() - timedelta(days=14))]
    return render(
        request,
        "cardpicker/index.html",
        {
            "sources": [x.to_dict() for x in Source.objects.all()],
            "posts": posts,
            "exception": exception or "",
        },
    )


def elasticsearch_status(request: HttpRequest) -> HttpResponse:
    return JsonResponse({"online": "true" if ping_elasticsearch() else "false"})


def new_cards(request: HttpRequest) -> HttpResponse:
    # serves the What's New page - this function returns the first page of results for all sources for
    # cards uploaded in the last two weeks

    s = search_new_elasticsearch_definition()
    results = {}
    try:
        for source in Source.objects.all():
            result = search_new(s, source.key)
            if result["qty"] > 0:
                results[source.key] = result
    except SearchExceptions.ConnectionTimedOutException as e:
        # display empty What's New page with error message if unable to connect to elasticsearch
        return render(request, "cardpicker/new.html", {"exception": str(e.args[0])})

    return render(
        request,
        "cardpicker/new.html",
        {"sources": {x.key: x.to_dict() for x in Source.objects.all()}, "results": results},
    )


def search_new_page(request: HttpRequest) -> HttpResponse:
    # triggers when the user clicks 'load more' on the What's New page
    # this function takes the current page number and source from the frontend and returns the next page
    # extract specified source and page from post request
    if (source_key := request.POST.get("source")) is None or (page_string := request.POST.get("page")) is None:
        # the frontend will handle this
        return JsonResponse({})

    s = search_new_elasticsearch_definition()
    results = {}
    result = search_new(s, source_key, int(page_string))
    if result["qty"] > 0:
        results[source_key] = result

    return JsonResponse({"results": results}, safe=False)


def legal(request: HttpRequest) -> HttpResponse:
    return render(request, "cardpicker/legal.html")


def guide(request: HttpRequest) -> HttpResponse:
    return render(request, "cardpicker/guide.html")


def contributions(request: HttpRequest) -> HttpResponse:
    sources, total_count_f = summarise_contributions()
    return render(request, "cardpicker/contributions.html", {"sources": sources, "total_count": total_count_f})


# region old API


@ErrorWrappers.to_json
def search_multiple(request: HttpRequest) -> HttpResponse:
    # search endpoint function - the frontend requests the search results for this query as JSON
    drive_order, fuzzy_search = retrieve_search_settings(request)
    if len(drive_order) == 0:
        # the frontend will handle this
        return JsonResponse({})
    order = MPCOrder()
    order.from_json(json.loads(request.POST.get("order", "")))

    for face in Faces.get_faces():
        for item in order[face].values():
            result = search(drive_order, fuzzy_search, item.query, item.req_type)
            item.insert_data(result)
    result = search(drive_order, fuzzy_search, order.cardback.query, order.cardback.req_type)
    order.cardback.insert_data(result)
    return JsonResponse(order.to_dict())


@ErrorWrappers.to_json
def search_individual(request: HttpRequest) -> HttpResponse:
    # search endpoint function - the frontend requests the search results for this query as JSON
    drive_order, fuzzy_search = retrieve_search_settings(request)
    if len(drive_order) == 0:
        # the frontend will handle this
        return JsonResponse({})
    query = request.POST.get("query", "").rstrip("\n")
    req_type = ReqTypes.CARD
    if req_type_string := request.POST.get("req_type"):
        req_type = ReqTypes(req_type_string)  # TODO: validation on this

    return JsonResponse(search(drive_order, fuzzy_search, query, req_type))


def search(drive_order: list[str], fuzzy_search: bool, query: str, req_type: ReqTypes) -> dict[str, Any]:
    # this function can either receive a request with "normal" type with query like "t:goblin",
    # or a request with "token" type with query like "goblin", so handle both of those cases here
    if query.lower()[0:2] == "t:":
        query = query[2:]
        req_type = ReqTypes.TOKEN

    # now that we've potentially trimmed the query for tokens, convert the query to a searchable string
    query = to_searchable(query)

    # search for tokens if this request is for a token
    if req_type == ReqTypes.TOKEN:
        results = query_es_token(drive_order, fuzzy_search, query)

    # search for cardbacks if request is for cardbacks
    elif req_type == ReqTypes.CARDBACK:
        results = query_es_cardback()

    # otherwise, search normally
    else:
        results = query_es_card(drive_order, fuzzy_search, query)

    return {"data": results, "req_type": req_type, "query": query}


@ErrorWrappers.to_index
def review(request: HttpRequest) -> HttpResponse:
    # return the review page with the order dict and quantity from parsing the given text input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputText(request.POST)
        if form.is_valid():
            # retrieve drive order and raw user input from request
            drive_order, fuzzy_search = retrieve_search_settings(request)
            if len(drive_order) == 0:
                return redirect("index")
            lines_raw = form["card_list"].value()

            # parse the text input to obtain the order dict and quantity in this order
            order = MPCOrder()
            qty = order.from_text(lines_raw)

            # build context
            context = build_context(drive_order, fuzzy_search, order.to_dict(), qty)

            return render(request, "cardpicker/review.html", context)

    return redirect("index")


@ErrorWrappers.to_json
def insert_text(request: HttpRequest) -> HttpResponse:
    # return a JSON response with the order dict and quantity from parsing the given input
    # used for inserting new cards into an existing order on the review page
    if (text := request.POST.get("text")) is None or (offset_string := request.POST.get("offset")) is None:
        # frontend will handle this
        return JsonResponse({})

    offset = int(offset_string)

    # parse the text input to obtain the order dict and quantity in this addition to the order
    order = MPCOrder()
    qty = order.from_text(text, offset)

    # remove the "-" element from the common cardback slot list so the selected common cardback doesn't reset on us
    order.remove_common_cardback()

    # build context
    context = {"order": order.to_dict(), "qty": qty}

    return JsonResponse(context)


@ErrorWrappers.to_index
def input_csv(request: HttpRequest) -> HttpResponse:
    # return the review page with the order dict and quantity from parsing the given CSV input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputCSV(request.POST, request.FILES)
        if form.is_valid():
            # retrieve drive order and csv file from request
            drive_order, fuzzy_search = retrieve_search_settings(request)
            if len(drive_order) == 0:
                return redirect("index")
            csvfile = request.FILES["file"].read()  # type: ignore  # TODO: revisit this and type it properly

            # parse the csv file to obtain the order dict and quantity in this order
            order = MPCOrder()
            qty = order.from_csv(csvfile)

            # build context
            context = build_context(drive_order, fuzzy_search, order.to_dict(), qty)

            return render(request, "cardpicker/review.html", context)

    return redirect("index")


@ErrorWrappers.to_index
def input_xml(request: HttpRequest) -> HttpResponse:
    # return the review page with the order dict and quantity from parsing the given XML input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputXML(request.POST, request.FILES)
        if form.is_valid():
            try:
                # retrieve drive order and XML file from request
                drive_order, fuzzy_search = retrieve_search_settings(request)
                if len(drive_order) == 0:
                    return redirect("index")
                xmlfile = request.FILES["file"].read()  # type: ignore  # TODO: revisit this and type it properly

                # parse the XML file to obtain the order dict and quantity in this order
                order = MPCOrder()
                qty = order.from_xml(xmlfile, 0)

                # build context
                context = build_context(drive_order, fuzzy_search, order.to_dict(), qty)

                return render(request, "cardpicker/review.html", context)

            except IndexError:
                # IndexErrors can occur when trying to parse old XMLs that don't include the search query
                return redirect("index")

    return redirect("index")


@ErrorWrappers.to_json
def insert_xml(request: HttpRequest) -> HttpResponse:
    # return a JSON response with the order dict and quantity from parsing the given XML input
    # used for inserting new cards into an existing order on the review page
    if (xml := request.POST.get("xml")) is None or (offset_string := request.POST.get("offset")) is None:
        # frontend will handle this
        return JsonResponse({})

    offset = int(offset_string)
    # parse the XML input to obtain the order dict and quantity in this addition to the order
    order = MPCOrder()
    qty = order.from_xml(xml, offset)

    # remove the - element from the common cardback slot list so the selected common cardback doesn't reset on us
    order.remove_common_cardback()

    # build context
    context = {"order": order.to_dict(), "qty": qty}

    return JsonResponse(context)


@ErrorWrappers.to_index
def input_link(request: HttpRequest) -> HttpResponse:
    # return the review page with the order dict and quantity from parsing the given XML input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputLink(request.POST)
        if form.is_valid():
            try:
                # retrieve drive order and list URL from request
                drive_order, fuzzy_search = retrieve_search_settings(request)
                if len(drive_order) == 0:
                    return redirect("index")
                url = form["list_url"].value()

                # parse the link input to obtain the order dict and quantity in this order
                order = MPCOrder()
                qty = order.from_link(url)

                # build context
                context = build_context(drive_order, fuzzy_search, order.to_dict(), qty)

                return render(request, "cardpicker/review.html", context)

            except IndexError:
                # IndexErrors can occur when trying to parse old XMLs that don't include the search query
                return redirect("index")

    return redirect("index")


@ErrorWrappers.to_json
def insert_link(request: HttpRequest) -> HttpResponse:
    # return a JSON response with the order dict and quantity from parsing the given XML input
    # used for inserting new cards into an existing order on the review page
    if (list_url := request.POST.get("list_url")) is None or (offset_string := request.POST.get("offset")) is None:
        # frontend will handle this
        return JsonResponse({})
    offset = int(offset_string)
    # parse the XML input to obtain the order dict and quantity in this addition to the order
    order = MPCOrder()
    qty = order.from_link(list_url, offset)

    # remove the - element from the common cardback slot list so the selected common cardback doesn't reset on us
    order.remove_common_cardback()

    # build context
    context = {
        "order": order.to_dict(),
        "qty": qty,
    }

    return JsonResponse(context)


# endregion

# region new API


# TODO: rename these functions to something useful once they've all been hashed out.


def editor(request: HttpRequest) -> HttpResponse:
    return render(request, "cardpicker/editor.html")


@csrf_exempt
def api_function_1(request: HttpRequest) -> HttpResponse:
    """
    Return the first page of search results for a given list of queries.
    Each query should be of the form {card name, card type}.
    This function should also accept a set of search settings in a standard format.
    Return a dictionary of search results of the following form:
    {(card name, card type): {"num_hits": num_hits, "hits": [list of Card identifiers]}
    and it's assumed that `hits` starts from the first hit.
    """

    # TODO: ping elasticsearch here
    if request.method == "POST":
        # time.sleep(1)  # TODO: remove these. just for testing.
        json_body = json.loads(request.body)
        search_settings = SearchSettings.from_json_body(json_body)
        queries = SearchQuery.list_from_json_body(json_body)
        results: dict[str, dict[str, list[str]]] = defaultdict(dict)
        for query in queries:
            if results[query.query].get(query.card_type, None) is None:
                hits = query.retrieve_card_identifiers(search_settings=search_settings)
                results[query.query][query.card_type] = hits
        return JsonResponse({"results": results})
    else:
        ...  # TODO: return error response
    return JsonResponse({})


@csrf_exempt
def api_function_2(request: HttpRequest) -> HttpResponse:
    # TODO: bit confusing to call this `getCards` while expecting POST
    if request.method == "POST":
        # time.sleep(2)  # TODO: remove these. just for testing.
        json_body = json.loads(request.body)
        card_identifiers = json_body.get("card_identifiers", [])
        # if len(card_identifiers) > 100:  # TODO
        #     card_identifiers = card_identifiers[0:100]
        results = {x.identifier: x.to_dict() for x in Card.objects.filter(identifier__in=card_identifiers)}
        return JsonResponse({"results": results})
    else:
        ...  # TODO: return error response
    return JsonResponse({})


@csrf_exempt
def api_function_3(request: HttpRequest) -> HttpResponse:
    """
    Return a list of sources.
    """

    results = {x.pk: x.to_dict() for x in Source.objects.order_by("ordinal", "pk")}
    return JsonResponse({"results": results})


@csrf_exempt
def api_function_4(request: HttpRequest) -> HttpResponse:
    """
    Return a list of double-faced cards. The unedited names are returned and the frontend is expected to sanitise them.
    """

    dfc_pairs = dict((x.front, x.back) for x in DFCPair.objects.all())
    return JsonResponse({"dfc_pairs": dfc_pairs})


@csrf_exempt
def api_function_5(request: HttpRequest) -> HttpResponse:
    """
    Return a list of cardstocks.
    """

    cardstocks = [{"name": "S30", "can_be_foil": True}]  # TODO
    return JsonResponse({"cardstocks": cardstocks})


@csrf_exempt
def api_function_6(request: HttpRequest) -> HttpResponse:
    """
    Return a list of cardbacks.
    """

    # TODO: think about the best way to order these results (after ordering by priority)
    cardbacks = [x.identifier for x in Card.objects.filter(card_type=CardTypes.CARDBACK).order_by("-priority", "name")]
    return JsonResponse({"cardbacks": cardbacks})


@csrf_exempt
def api_function_7(request: HttpRequest) -> HttpResponse:
    """
    Return a list of import sites.
    """

    time.sleep(4)
    import_sites = [{"name": x.__name__, "url": x().get_base_url()} for x in ImportSites]
    return JsonResponse({"import_sites": import_sites})


@csrf_exempt
def api_function_8(request: HttpRequest) -> HttpResponse:
    """
    Return the result of querying an import site for the specified URL.
    TODO: rewrite this, the english is a bit bad.
    """

    if request.method == "POST":
        json_body = json.loads(request.body)
        url = json_body.get("url", None)
        if url is None:
            ...  # TODO: handle this case
        for site in ImportSites:
            if url.startswith(site.get_base_url()):
                text = site.retrieve_card_list(url)
                return JsonResponse({"cards": text})
        # TODO: return error indicating site is not supported
    else:
        ...  # TODO: return error response
    return JsonResponse({})


@csrf_exempt
def api_function_9(request: HttpRequest) -> HttpResponse:
    """
    Return a list of sample cards you can query this database for.
    Used in the placeholder text of the Add Cards — Text component in the frontend.
    """

    # TODO: consider reusing this to display some random cards on the landing page

    # TODO: tidy this up a bit

    # TODO: i don't know how to do this in a single query in the Django ORM :(
    identifiers = {
        card_type: list(Card.objects.filter(card_type=card_type).values_list("id", flat=True)[0:1000])
        for card_type in CardTypes
    }
    selected_identifiers = {
        card_type: choices(
            identifiers[card_type], k=min(4 if card_type == CardTypes.CARD else 1, len(identifiers[card_type]))
        )
        for card_type in CardTypes
    }
    men = {
        x[0]: re.sub(r"\([^)]*\)", "", x[1]).strip()
        for x in Card.objects.filter(pk__in=[y for z in selected_identifiers.values() for y in z]).values_list(
            "id", "name"
        )
    }
    return_value = {
        card_type: [(randint(1, 4), men[identifier]) for identifier in identifiers]
        for card_type, identifiers in selected_identifiers.items()
    }

    return JsonResponse({"cards": return_value})


@csrf_exempt
def api_function_10(request: HttpRequest) -> HttpResponse:
    sources, total_count_f = summarise_contributions()
    return JsonResponse({"sources": sources, "total_count": total_count_f})


# endregion
