import itertools
import json
from collections import defaultdict
from random import sample
from typing import Any, Callable, TypeVar, Union, cast

import pycountry
from elasticsearch_dsl.index import Index
from pydantic import ValidationError

from django.conf import settings
from django.db.models import Q
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from cardpicker.constants import (
    CARDS_PAGE_SIZE,
    DEFAULT_LANGUAGE,
    EDITOR_SEARCH_MAX_QUERIES,
    EXPLORE_SEARCH_MAX_PAGE_SIZE,
    NSFW,
)
from cardpicker.documents import CardSearch
from cardpicker.integrations.integrations import get_configured_game_integration
from cardpicker.integrations.patreon import get_patreon_campaign_details, get_patrons
from cardpicker.models import Card, CardTypes, DFCPair, Source, summarise_contributions
from cardpicker.schema_types import CardbacksRequest, CardbacksResponse
from cardpicker.schema_types import Cards as SampleCards
from cardpicker.schema_types import (
    CardsRequest,
    CardsResponse,
    ContributionsResponse,
    DFCPairsResponse,
    EditorSearchRequest,
    EditorSearchResponse,
    ErrorResponse,
    ExploreSearchRequest,
    ExploreSearchResponse,
    ImportSite,
    ImportSiteDecklistRequest,
    ImportSiteDecklistResponse,
    ImportSitesResponse,
    Info,
    InfoResponse,
    Language,
    LanguagesResponse,
    NewCardsFirstPage,
    NewCardsFirstPagesResponse,
    NewCardsPageResponse,
    Patreon,
    SampleCardsResponse,
    SearchEngineHealthResponse,
    SortBy,
    SourcesResponse,
    TagsResponse,
)
from cardpicker.search.search_functions import (
    SearchExceptions,
    get_new_cards_paginator,
    get_search,
    ping_elasticsearch,
    retrieve_card_identifiers,
    retrieve_cardback_identifiers,
)
from cardpicker.tags import Tags

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


class BadRequestException(Exception):
    pass


class ErrorWrappers:
    """
    View function decorators which gracefully handle exceptions and allow the exception message to be displayed
    to the user.
    """

    @staticmethod
    def to_json(func: F) -> F:
        def wrapper(*args: Any, **kwargs: Any) -> Union[F, HttpResponse]:
            try:
                return func(*args, **kwargs)
            except ValidationError as e:
                # send pydantic validation errors to client
                error = ErrorResponse(
                    name="Schema error/s",
                    message="See `errors` field for detailed breakdown.",
                    errors=[dict(item) for item in e.errors()],
                )
                return JsonResponse(error.model_dump(), status=400)
            except SearchExceptions.ElasticsearchOfflineException:
                error = ErrorResponse(name="Search engine is offline", message=None)
                return JsonResponse(error.model_dump(), status=500)
            except BadRequestException as bad_request_exception:
                error = ErrorResponse(name="Bad request", message=bad_request_exception.args[0])
                return JsonResponse(error.model_dump(), status=400)
            except Exception as e:
                # sentry_sdk.capture_exception(e)
                error = ErrorResponse(name=f"Unhandled {e.__class__.__name__}", message=str(e.args[0]))
                return JsonResponse(error.model_dump(), status=500)

        return cast(F, wrapper)


@csrf_exempt
@ErrorWrappers.to_json
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

    editor_search_request = EditorSearchRequest.model_validate(json.loads(request.body))
    if not ping_elasticsearch():
        raise SearchExceptions.ElasticsearchOfflineException()
    if not Index(CardSearch.Index.name).exists():
        raise SearchExceptions.IndexNotFoundException(CardSearch.__name__)

    if len(editor_search_request.queries) > EDITOR_SEARCH_MAX_QUERIES:
        raise BadRequestException(
            f"Invalid query count {len(editor_search_request.queries)}. "
            f"Must be less than or equal to {EDITOR_SEARCH_MAX_QUERIES}."
        )

    results: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for query, card_type in sorted({(item.query, item.cardType) for item in editor_search_request.queries}):
        if query is not None and results[query].get(card_type.value, None) is None:
            hits = retrieve_card_identifiers(
                query=query, card_type=card_type, search_settings=editor_search_request.searchSettings
            )
            results[query][card_type.value] = hits
    return JsonResponse(EditorSearchResponse(results=results).model_dump())


@csrf_exempt
@ErrorWrappers.to_json
def post_explore_search(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    explore_search_request = ExploreSearchRequest.model_validate(json.loads(request.body))
    if explore_search_request.pageStart < 0:
        raise BadRequestException(f"Invalid page start {explore_search_request.pageStart}. Must be greater than zero.")
    if not (0 < explore_search_request.pageSize <= EXPLORE_SEARCH_MAX_PAGE_SIZE):
        raise BadRequestException(
            f"Invalid page size {explore_search_request.pageSize}. Must be less than or equal to {EXPLORE_SEARCH_MAX_PAGE_SIZE}."
        )
    if not ping_elasticsearch():
        raise SearchExceptions.ElasticsearchOfflineException()
    if not Index(CardSearch.Index.name).exists():
        raise SearchExceptions.IndexNotFoundException(CardSearch.__name__)

    sort: dict[str, dict[str, str]] = {
        SortBy.nameAscending: {"searchq_keyword": {"order": "asc"}},
        SortBy.nameDescending: {"searchq_keyword": {"order": "desc"}},
        SortBy.dateAscending: {"date": {"order": "asc"}, "searchq_keyword": {"order": "asc"}},
        SortBy.dateDescending: {"date": {"order": "desc"}, "searchq_keyword": {"order": "asc"}},
    }[explore_search_request.sortBy]

    s = get_search(
        search_settings=explore_search_request.searchSettings,
        query=explore_search_request.query,
        card_types=explore_search_request.cardTypes,
    ).sort(sort)
    count = s.extra(track_total_hits=True).count()

    s_sliced = s[explore_search_request.pageStart : explore_search_request.pageStart + explore_search_request.pageSize]
    card_ids = [man.identifier for man in s_sliced.execute()]
    # TODO: the below code feels inefficient but is set up this way to ensure sorting from elasticsearch is respected.
    card_id_object_dict = {card.identifier: card.serialise() for card in Card.objects.filter(identifier__in=card_ids)}
    cards = [card_id_object_dict[card_id] for card_id in card_ids]
    return JsonResponse(ExploreSearchResponse(cards=cards, count=count).model_dump())


@csrf_exempt
@ErrorWrappers.to_json
def post_cards(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    cards_request = CardsRequest.model_validate(json.loads(request.body))
    if len(cards_request.cardIdentifiers) > CARDS_PAGE_SIZE:
        raise BadRequestException(
            f"Invalid card count {len(cards_request.cardIdentifiers)}. "
            f"Must be less than or equal to {CARDS_PAGE_SIZE}."
        )

    results = {
        card.identifier: card.serialise() for card in Card.objects.filter(identifier__in=cards_request.cardIdentifiers)
    }
    return JsonResponse(CardsResponse(results=results).model_dump())


@csrf_exempt
@ErrorWrappers.to_json
def get_sources(request: HttpRequest) -> HttpResponse:
    """
    Return a list of sources.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    results = {str(source.pk): source.serialise() for source in Source.objects.order_by("ordinal", "pk")}
    return JsonResponse(SourcesResponse(results=results).model_dump())


@csrf_exempt
@ErrorWrappers.to_json
def get_dfc_pairs(request: HttpRequest) -> HttpResponse:
    """
    Return a list of double-faced cards. The unedited names are returned and the frontend is expected to sanitise them.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    dfc_pairs = {x.front: x.back for x in DFCPair.objects.all()}
    return JsonResponse(DFCPairsResponse(dfcPairs=dfc_pairs).model_dump())


@csrf_exempt
@ErrorWrappers.to_json
def get_languages(request: HttpRequest) -> HttpResponse:
    """
    Return the list of all unique languages among cards in the database.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")
    return JsonResponse(
        LanguagesResponse(
            languages=sorted(
                [
                    Language(name=language.name, code=row[0].upper())
                    for row in Card.objects.order_by().values_list("language").distinct()
                    if (language := pycountry.languages.get(alpha_2=row[0])) is not None
                ],
                # sort like this so DEFAULT_LANGUAGE is first, then the rest of the languages are in alphabetical order
                key=lambda language: "-" if language.code == DEFAULT_LANGUAGE.alpha_2 else language.name,
            )
        ).model_dump()
    )


@csrf_exempt
@ErrorWrappers.to_json
def get_tags(request: HttpRequest) -> HttpResponse:
    """
    Return a list of all tags that cards can be tagged with.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")
    return JsonResponse(
        TagsResponse(
            tags=sorted([tag.serialise() for tag in Tags().tags.values() if tag.parent is None], key=lambda x: x.name)
        ).model_dump()
    )


@csrf_exempt
@ErrorWrappers.to_json
def post_cardbacks(request: HttpRequest) -> HttpResponse:
    """
    Return a list of cardbacks, possibly filtered by the user's search settings.
    """

    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    cardbacks_request = CardbacksRequest.model_validate(json.loads(request.body))
    cardbacks = retrieve_cardback_identifiers(search_settings=cardbacks_request.searchSettings)
    return JsonResponse(CardbacksResponse(cardbacks=cardbacks).model_dump())


@csrf_exempt
@ErrorWrappers.to_json
def get_import_sites(request: HttpRequest) -> HttpResponse:
    """
    Return a list of import sites.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    game_integration = get_configured_game_integration()
    if game_integration is None:
        return JsonResponse(ImportSitesResponse(importSites=[]).model_dump())

    import_sites = [
        ImportSite(name=site.__name__, url=f"https://{site.get_host_names()[0]}")
        for site in game_integration.get_import_sites()
    ]
    return JsonResponse(ImportSitesResponse(importSites=import_sites).model_dump())


@csrf_exempt
@ErrorWrappers.to_json
def post_import_site_decklist(request: HttpRequest) -> HttpResponse:
    """
    Read the specified import site URL and process & return the associated decklist.
    """

    if request.method != "POST":
        raise BadRequestException("Expected POST request.")

    game_integration = get_configured_game_integration()
    if game_integration is None:
        raise BadRequestException("No game integration is configured on this server.")

    import_site_decklist_request = ImportSiteDecklistRequest.model_validate(json.loads(request.body))
    try:
        decklist = game_integration.query_import_site(url=import_site_decklist_request.url)
        if decklist is None:
            raise BadRequestException("The specified decklist URL does not match any known import sites.")
        return JsonResponse(ImportSiteDecklistResponse(cards=decklist).model_dump())
    except ValueError as e:
        raise BadRequestException(str(e))


@csrf_exempt
@ErrorWrappers.to_json
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
    cards = [card.serialise() for card in Card.objects.filter(pk__in=selected_identifiers).order_by("card_type")]
    cards_by_type = {
        card_type: list(grouped_cards_iterable)
        for card_type, grouped_cards_iterable in itertools.groupby(cards, key=lambda x: x.cardType)
    }

    sample_cards_response = SampleCardsResponse(
        cards=SampleCards(**({CardTypes.CARD: [], CardTypes.CARDBACK: [], CardTypes.TOKEN: []} | cards_by_type))
    )
    return JsonResponse(sample_cards_response.model_dump())


@csrf_exempt
@ErrorWrappers.to_json
def get_contributions(request: HttpRequest) -> HttpResponse:
    """
    Return a summary of contributions to the database.
    Used by the Contributions page.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    sources, card_count_by_type, total_database_size = summarise_contributions()
    return JsonResponse(
        ContributionsResponse(
            sources=sources, cardCountByType=card_count_by_type, totalDatabaseSize=total_database_size
        ).model_dump()
    )


@csrf_exempt
@ErrorWrappers.to_json
def get_new_cards_first_pages(request: HttpRequest) -> HttpResponse:
    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    results: dict[str, NewCardsFirstPage] = {}
    for source in Source.objects.all():
        paginator = get_new_cards_paginator(source=source)
        if paginator.count > 0:
            results[source.key] = NewCardsFirstPage(
                source=source.serialise(),
                hits=paginator.count,
                pages=paginator.num_pages,
                cards=[card.serialise() for card in paginator.get_page(1).object_list],
            )
    return JsonResponse(NewCardsFirstPagesResponse(results=results).model_dump())


@csrf_exempt
@ErrorWrappers.to_json
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
        return JsonResponse(
            NewCardsPageResponse(cards=[card.serialise() for card in paginator.page(page).object_list]).model_dump()
        )
    except ValueError:
        raise BadRequestException("Invalid page specified.")


@csrf_exempt
@ErrorWrappers.to_json
def get_info(request: HttpRequest) -> HttpResponse:
    """
    Return a stack of metadata about the server for the frontend to display.
    It's expected that this route will be called once when the server is connected.
    """

    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    campaign, tiers = get_patreon_campaign_details()
    members = get_patrons(campaign.id, tiers) if campaign is not None and tiers is not None else None

    return JsonResponse(
        InfoResponse(
            info=Info(
                name=settings.SITE_NAME,
                description=settings.DESCRIPTION,
                email=settings.TARGET_EMAIL,
                reddit=settings.REDDIT,
                discord=settings.DISCORD,
                patreon=Patreon(
                    url=settings.PATREON_URL,
                    members=members or [],
                    tiers=tiers,
                    campaign=campaign,
                ),
            )
        ).model_dump()
    )


@csrf_exempt
@ErrorWrappers.to_json
def get_search_engine_health(request: HttpRequest) -> HttpResponse:
    if request.method != "GET":
        raise BadRequestException("Expected GET request.")

    return JsonResponse(SearchEngineHealthResponse(online=ping_elasticsearch()).model_dump())
