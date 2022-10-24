import json
from collections import defaultdict
from datetime import timedelta
from typing import Any, Callable, Optional, TypeVar, Union, cast

from blog.models import BlogPost

from django.contrib.auth.forms import AuthenticationForm
from django.db import connection
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone

from cardpicker.forms import InputCSV, InputLink, InputText, InputXML
from cardpicker.models import CardTypes, Source
from cardpicker.mpcorder import Faces, MPCOrder, ReqTypes
from cardpicker.sources.source_types import SourceTypeChoices
from cardpicker.utils.sanitisation import to_searchable
from cardpicker.utils.search_functions import (
    SearchExceptions,
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
    """
    Report on the number of cards, cardbacks, and tokens that each Source has, as well as the average DPI across all
    three card types.
    Rawdogging the SQL here to minimise the number of hits to the database. I might come back to this at some point
    to rewrite in Django ORM at a later point.
    """

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                cardpicker_source.name,
                cardpicker_source.identifier,
                cardpicker_source.source_type,
                cardpicker_source.external_link,
                cardpicker_source.description,
                cardpicker_source.ordinal,
                COALESCE(SUM(cardpicker_card.dpi), 0),
                COUNT(cardpicker_card.dpi)
            FROM cardpicker_source
            LEFT JOIN cardpicker_card ON cardpicker_source.id = cardpicker_card.source_id
            GROUP BY cardpicker_source.name,
                cardpicker_source.identifier,
                cardpicker_source.source_type,
                cardpicker_source.external_link,
                cardpicker_source.description,
                cardpicker_source.ordinal
            ORDER BY cardpicker_source.ordinal, cardpicker_source.name
            """
        )
        results_1 = cursor.fetchall()
        cursor.execute(
            """
            SELECT
                cardpicker_source.identifier,
                cardpicker_card.card_type,
                COUNT(cardpicker_card.card_type)
            FROM cardpicker_source
            LEFT JOIN cardpicker_card ON cardpicker_source.id = cardpicker_card.source_id
            GROUP BY cardpicker_source.identifier, cardpicker_card.card_type
            """
        )
        results_2 = cursor.fetchall()

    source_card_count_by_type: dict[str, dict[str, int]] = defaultdict(dict)
    card_count_by_type: dict[str, int] = defaultdict(int)
    for (identifier, card_type, count) in results_2:
        source_card_count_by_type[identifier][card_type] = count
        card_count_by_type[card_type] += count
    sources = []
    for (name, identifier, source_type, external_link, description, ordinal, total_dpi, total_count) in results_1:
        sources.append(
            {
                "name": name,
                "identifier": identifier,
                "source_type": SourceTypeChoices[source_type].label,
                "external_link": external_link,
                "description": description,
                "qty_cards": f"{source_card_count_by_type[identifier].get(CardTypes.CARD, 0):,d}",
                "qty_cardbacks": f"{source_card_count_by_type[identifier].get(CardTypes.CARDBACK, 0) :,d}",
                "qty_tokens": f"{source_card_count_by_type[identifier].get(CardTypes.TOKEN, 0) :,d}",
                "avgdpi": f"{(total_dpi / total_count):.2f}" if total_count > 0 else 0,
            }
        )

    total_count = [card_count_by_type[x] for x in CardTypes]
    total_count.append(sum(total_count))
    total_count_f = [f"{x:,d}" for x in total_count]

    return render(request, "cardpicker/contributions.html", {"sources": sources, "total_count": total_count_f})


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
