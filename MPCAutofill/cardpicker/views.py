import itertools
import json
from collections import defaultdict
from random import sample
from typing import Any, Callable, TypeVar, Union, cast

import pycountry
import sentry_sdk
from elasticsearch_dsl.index import Index
from jsonschema import ValidationError, validate

from django.conf import settings
from django.db.models import Q
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from cardpicker.constants import CARDS_PAGE_SIZE, DEFAULT_LANGUAGE, NSFW
from cardpicker.documents import CardSearch
from cardpicker.integrations.integrations import get_configured_game_integration
from cardpicker.integrations.patreon import get_patreon_campaign_details, get_patrons
from cardpicker.models import Card, CardTypes, DFCPair, Source, summarise_contributions
from cardpicker.search.search_functions import (
    SearchExceptions,
    SearchQuery,
    SearchSettings,
    get_new_cards_paginator,
    get_search,
    ping_elasticsearch,
)
from cardpicker.tags import Tags

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


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
def post_editor_search(request: HttpRequest) -> HttpResponse:
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
        search_settings = SearchSettings.from_json_body(json_body)
        queries = SearchQuery.list_from_json_body(json_body)
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
def post_explore_search(request: HttpRequest) -> HttpResponse:
    """
    TODO:
    - get page token off json body
    - return page token in response
    - get search query off json body
    """

    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    json_body = json.loads(request.body)

    try:
        search_settings = SearchSettings.from_json_body(json_body)
        search_query = SearchQuery.from_json_body(json_body["query"])  # TODO: bad and hacked in, obviously
    except ValidationError as e:
        raise BadRequestException(f"The provided JSON body is invalid:\n\n{e.message}")

    if not ping_elasticsearch():
        raise SearchExceptions.ElasticsearchOfflineException()
    if not Index(CardSearch.Index.name).exists():
        raise SearchExceptions.IndexNotFoundException(CardSearch.__name__)

    s = get_search(search_settings=search_settings, search_query=search_query).sort(
        {
            "date": {
                "order": "desc",
            },
            "searchq_keyword": {
                "order": "asc",
            },
        }
    )
    s.extra(track_total_hits=True).count()
    card_ids = [man.identifier for man in s[0:60].execute()]  # TODO: plumb through page token, obviously
    cards = [card.to_dict() for card in Card.objects.filter(identifier__in=card_ids)]
    return JsonResponse({"results": cards})


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
        search_settings = SearchSettings.from_json_body(json_body)
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

    import_sites = [
        {"name": site.__name__, "url": f"https://{site.get_host_names()[0]}"}
        for site in game_integration.get_import_sites()
    ]
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
