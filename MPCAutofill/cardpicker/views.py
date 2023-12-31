import datetime as dt
import itertools
import json
from collections import defaultdict
from random import sample
from typing import Any, Callable, Optional, TypeVar, Union, cast

import pycountry
import sentry_sdk
from blog.models import BlogPost
from elasticsearch_dsl.index import Index
from jsonschema import ValidationError, validate

from django.conf import settings
from django.db.models import Q
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from cardpicker.constants import CARDS_PAGE_SIZE, DEFAULT_LANGUAGE, NSFW
from cardpicker.documents import CardSearch
from cardpicker.forms import InputCSV, InputLink, InputText, InputXML
from cardpicker.integrations.integrations import get_configured_game_integration
from cardpicker.integrations.patreon import get_patreon_campaign_details, get_patrons
from cardpicker.models import Card, CardTypes, DFCPair, Source, summarise_contributions
from cardpicker.mpcorder import Faces, MPCOrder, ReqTypes
from cardpicker.search.sanitisation import to_searchable
from cardpicker.search.search_functions import (
    SearchExceptions,
    build_context,
    get_new_cards_paginator,
    parse_json_body_as_search_data,
    parse_json_body_as_search_settings,
    ping_elasticsearch,
    query_es_card,
    query_es_cardback,
    query_es_token,
    retrieve_search_settings,
    search_new,
    search_new_elasticsearch_definition,
)
from cardpicker.tags import Tags

from MPCAutofill.settings import PATREON_URL

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


# region old API


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
    posts = [
        x.get_synopsis() for x in BlogPost.objects.filter(date_created__gte=timezone.now() - dt.timedelta(days=14))
    ]
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
    sources, card_count_by_type, total_database_size = summarise_contributions()
    total_count = [card_count_by_type[x] for x in CardTypes]
    total_count.append(sum(total_count))
    total_database_size_f = f"{(total_database_size / 1_000_000_000):.2f} GB"

    return render(
        request,
        "cardpicker/contributions.html",
        {"sources": sources, "total_count": [f"{x:,d}" for x in total_count], "total_size": total_database_size_f},
    )


def patrons(request: HttpRequest) -> HttpResponse:
    # Disable page without Patreon
    if not PATREON_URL:
        return redirect("index")

    # Campaign details
    campaign, tiers = get_patreon_campaign_details()
    members = get_patrons(campaign["id"], tiers) if campaign is not None and tiers is not None else []
    return render(request, "cardpicker/patrons.html", {"members": members, "tiers": tiers, "campaign": campaign})


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


class BadRequestException(Exception):
    pass


class NewErrorWrappers:
    """
    View function decorators which gracefully handle exceptions and allow the exception message to be displayed
    to the user.
    """

    @staticmethod
    def to_json(func: F) -> F:
        def wrapper(*args: Any, **kwargs: Any) -> Union[F, HttpResponse]:
            try:
                return func(*args, **kwargs)
            except SearchExceptions.ElasticsearchOfflineException:
                return JsonResponse({"name": "Search engine is offline", "message": None}, status=500)
            except BadRequestException as bad_request_exception:
                return JsonResponse({"name": "Bad request", "message": bad_request_exception.args[0]}, status=400)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                return JsonResponse(
                    {"name": f"Unhandled {e.__class__.__name__}", "message": str(e.args[0])}, status=500
                )

        return cast(F, wrapper)


@csrf_exempt
@NewErrorWrappers.to_json
def post_search_results(request: HttpRequest) -> HttpResponse:
    """
    Return the first page of search results for a given list of queries.
    Each query should be of the form {card name, card type}.
    This function should also accept a set of search settings in a standard format.
    Return a dictionary of search results of the following form:
    {(card name, card type): {"num_hits": num_hits, "hits": [list of Card identifiers]}
    and it's assumed that `hits` starts from the first hit.
    """

    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    json_body = json.loads(request.body)

    try:
        search_settings, queries = parse_json_body_as_search_data(json_body)
    except ValidationError as e:
        raise BadRequestException(f"The provided JSON body is invalid:\n\n{e.message}")

    if not ping_elasticsearch():
        raise SearchExceptions.ElasticsearchOfflineException()
    if not Index(CardSearch.Index.name).exists():
        raise SearchExceptions.IndexNotFoundException(CardSearch.__name__)

    results: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for query in queries:
        if results[query.query].get(query.card_type, None) is None:
            hits = query.retrieve_card_identifiers(search_settings=search_settings)
            results[query.query][query.card_type] = hits
    return JsonResponse({"results": results})


@csrf_exempt
@NewErrorWrappers.to_json
def post_cards(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    json_body = json.loads(request.body)
    try:
        validate(
            json_body,
            schema={
                "type": "object",
                "properties": {
                    "card_identifiers": {"type": "array", "items": {"type": "string"}, "maxItems": CARDS_PAGE_SIZE}
                },
                "required": ["card_identifiers"],
                "additionalProperties": False,
            },
        )
    except ValidationError as e:
        raise BadRequestException(f"Malformed JSON body:\n\n{e.message}")

    results = {x.identifier: x.to_dict() for x in Card.objects.filter(identifier__in=json_body["card_identifiers"])}
    return JsonResponse({"results": results})


@csrf_exempt
@NewErrorWrappers.to_json
def get_sources(request: HttpRequest) -> HttpResponse:
    """
    Return a list of sources.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    results = {x.pk: x.to_dict() for x in Source.objects.order_by("ordinal", "pk")}
    return JsonResponse({"results": results})


@csrf_exempt
@NewErrorWrappers.to_json
def get_dfc_pairs(request: HttpRequest) -> HttpResponse:
    """
    Return a list of double-faced cards. The unedited names are returned and the frontend is expected to sanitise them.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    dfc_pairs = dict((x.front, x.back) for x in DFCPair.objects.all())
    return JsonResponse({"dfc_pairs": dfc_pairs})


@csrf_exempt
@NewErrorWrappers.to_json
def get_languages(request: HttpRequest) -> HttpResponse:
    """
    Return the list of all unique languages among cards in the database.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")
    return JsonResponse(
        {
            "languages": sorted(
                [
                    {"name": language.name, "code": row[0].upper()}
                    for row in Card.objects.order_by().values_list("language").distinct()
                    if (language := pycountry.languages.get(alpha_2=row[0])) is not None
                ],
                # sort like this so DEFAULT_LANGUAGE is first, then the rest of the languages are in alphabetical order
                key=lambda row: "-" if row["code"] == DEFAULT_LANGUAGE.alpha_2 else row["name"],
            )
        }
    )


@csrf_exempt
@NewErrorWrappers.to_json
def get_tags(request: HttpRequest) -> HttpResponse:
    """
    Return a list of all tags that cards can be tagged with.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")
    return JsonResponse(
        {"tags": sorted([tag.to_dict() for tag in Tags().tags.values() if tag.parent is None], key=lambda x: x["name"])}
    )


@csrf_exempt
@NewErrorWrappers.to_json
def post_cardbacks(request: HttpRequest) -> HttpResponse:
    """
    Return a list of cardbacks, possibly filtered by the user's search settings.
    """

    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    try:
        json_body = json.loads(request.body)
        search_settings = parse_json_body_as_search_settings(json_body)
    except ValidationError as e:
        raise BadRequestException(f"The provided JSON body is invalid:\n\n{e.message}")

    cardbacks = search_settings.retrieve_cardback_identifiers()
    return JsonResponse({"cardbacks": cardbacks})


@csrf_exempt
@NewErrorWrappers.to_json
def get_import_sites(request: HttpRequest) -> HttpResponse:
    """
    Return a list of import sites.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    game_integration = get_configured_game_integration()
    if game_integration is None:
        return JsonResponse({"import_sites": []})

    import_sites = [{"name": site.__name__, "url": site.get_base_url()} for site in game_integration.get_import_sites()]
    return JsonResponse({"import_sites": import_sites})


@csrf_exempt
@NewErrorWrappers.to_json
def post_import_site_decklist(request: HttpRequest) -> HttpResponse:
    """
    Read the specified import site URL and process & return the associated decklist.
    """

    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    game_integration = get_configured_game_integration()
    if game_integration is None:
        raise BadRequestException("No game integration is configured on this server.")

    json_body = json.loads(request.body)
    try:
        validate(
            json_body,
            schema={
                "type": "object",
                "properties": {"url": {"type": "string"}},
                "required": ["url"],
                "additionalProperties": False,
            },
        )
    except ValidationError as e:
        raise BadRequestException(f"Malformed JSON body:\n\n{e.message}")

    try:
        decklist = game_integration.query_import_site(json_body.get("url"))
        if decklist is None:
            raise BadRequestException("The specified decklist URL does not match any known import sites.")
        return JsonResponse({"cards": decklist})
    except ValueError as e:
        raise BadRequestException(str(e))


@csrf_exempt
@NewErrorWrappers.to_json
def get_sample_cards(request: HttpRequest) -> HttpResponse:
    """
    Return a selection of cards you can query this database for.
    Used in the placeholder text of the Add Cards — Text component in the frontend.

    TODO: i don't know how to do this in a single query in the Django ORM :(
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    # sample some large number of identifiers from the database (while avoiding sampling NSFW cards)
    identifiers = {
        card_type: list(
            Card.objects.filter(~Q(tags__overlap=[NSFW]) & Q(card_type=card_type)).values_list("id", flat=True)[0:5000]
        )
        for card_type in CardTypes
    }

    # select a few of those identifiers at random
    selected_identifiers = [
        identifier
        for card_type in CardTypes
        for identifier in sample(
            identifiers[card_type], k=min(4 if card_type == CardTypes.CARD else 1, len(identifiers[card_type]))
        )
    ]

    # retrieve the full ORM objects for the selected identifiers and group by type
    cards = [card.to_dict() for card in Card.objects.filter(pk__in=selected_identifiers).order_by("card_type")]
    cards_by_type = {
        card_type: list(grouped_cards_iterable)
        for card_type, grouped_cards_iterable in itertools.groupby(cards, key=lambda x: x["card_type"])
    }

    return JsonResponse({"cards": {CardTypes.CARD: [], CardTypes.CARDBACK: [], CardTypes.TOKEN: []} | cards_by_type})


@csrf_exempt
@NewErrorWrappers.to_json
def get_contributions(request: HttpRequest) -> HttpResponse:
    """
    Return a summary of contributions to the database.
    Used by the Contributions page.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    sources, card_count_by_type, total_database_size = summarise_contributions()
    return JsonResponse(
        {"sources": sources, "card_count_by_type": card_count_by_type, "total_database_size": total_database_size}
    )


@csrf_exempt
@NewErrorWrappers.to_json
def get_new_cards_first_pages(request: HttpRequest) -> HttpResponse:
    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    response_body: dict[str, dict[str, Any]] = {}
    for source in Source.objects.all():
        paginator = get_new_cards_paginator(source=source)
        if paginator.count > 0:
            response_body[source.key] = {
                "source": source.to_dict(),
                "hits": paginator.count,
                "pages": paginator.num_pages,
                "cards": [card.to_dict() for card in paginator.get_page(1).object_list],
            }
    return JsonResponse({"results": response_body})


@csrf_exempt
@NewErrorWrappers.to_json
def get_new_cards_page(request: HttpRequest) -> HttpResponse:
    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    source_key = request.GET.get("source")
    if not source_key:
        raise BadRequestException("Source not specified.")
    source_q = Source.objects.filter(key=source_key)

    if source_q.count() == 0:
        raise BadRequestException(f"Invalid source key {source_key} specified.")
    paginator = get_new_cards_paginator(source=source_q[0])

    page = request.GET.get("page")
    if page is None:
        raise BadRequestException("Page not specified.")
    try:
        page_int = int(page)
        if not (paginator.num_pages >= page_int > 0):
            raise BadRequestException(
                f"Invalid page {page_int} specified - must be between 1 and {paginator.num_pages} "
                f"for source {source_key}."
            )
        return JsonResponse({"cards": [card.to_dict() for card in paginator.page(page).object_list]})
    except ValueError:
        raise BadRequestException("Invalid page specified.")


@csrf_exempt
@NewErrorWrappers.to_json
def get_info(request: HttpRequest) -> HttpResponse:
    """
    Return a stack of metadata about the server for the frontend to display.
    It's expected that this route will be called once when the server is connected.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    campaign, tiers = get_patreon_campaign_details()
    members = get_patrons(campaign["id"], tiers) if campaign is not None and tiers is not None else None

    return JsonResponse(
        {
            "info": {
                "name": settings.SITE_NAME,
                "description": settings.DESCRIPTION,
                "email": settings.TARGET_EMAIL,
                "reddit": settings.REDDIT,
                "discord": settings.DISCORD,
                "patreon": {
                    "url": settings.PATREON_URL,
                    "members": members,
                    "tiers": tiers,
                    "campaign": campaign,
                },
            }
        }
    )


@csrf_exempt
@NewErrorWrappers.to_json
def get_search_engine_health(request: HttpRequest) -> HttpResponse:
    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    return JsonResponse({"online": ping_elasticsearch()})


# endregion
