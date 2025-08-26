import datetime as dt
import threading
from typing import Any, Callable, Optional, TypeVar, cast

import pycountry
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import ConnectionError as ElasticConnectionError
from elasticsearch_dsl.query import Bool, Match, Range, Terms

from django.conf import settings
from django.core.paginator import Paginator
from django.db.models import Q, QuerySet
from django.utils import timezone

from cardpicker.constants import NEW_CARDS_DAYS, NEW_CARDS_PAGE_SIZE
from cardpicker.documents import CardSearch
from cardpicker.models import Card, CardTypes, Source
from cardpicker.schema_types import CardType, SearchSettings
from cardpicker.search.sanitisation import to_searchable

thread_local = threading.local()  # Should only be called once per thread

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


class SearchExceptions:
    class ElasticsearchOfflineException(Exception):
        def __init__(self) -> None:
            self.message = "The search engine is offline."
            super().__init__(self.message)

    class IndexNotFoundException(Exception):
        def __init__(self, index: str) -> None:
            self.message = (
                f"The search index {index} does not exist. Usually, this happens because the database "
                f"is in the middle of updating - check back in a few minutes!"
            )
            super().__init__(self.message)

    class ConnectionTimedOutException(Exception):
        def __init__(self) -> None:
            self.message = "Unable to connect to the search engine (timed out)."
            super().__init__(self.message)


def get_elasticsearch_connection() -> Elasticsearch:
    if (es := getattr(thread_local, "elasticsearch", None)) is None:
        es = Elasticsearch([settings.ELASTICSEARCH_HOST], port=settings.ELASTICSEARCH_PORT)
    return es


def ping_elasticsearch() -> bool:
    return get_elasticsearch_connection().ping()


def elastic_connection(func: F) -> F:
    """
    Small function wrapper which makes elasticsearch's connection error more readable.
    """

    def wrapper(*args: Any, **kwargs: dict[str, Any]) -> F:
        try:
            return func(*args, **kwargs)
        except ElasticConnectionError:
            raise SearchExceptions.ConnectionTimedOutException

    return cast(F, wrapper)


def get_source_order(search_settings: SearchSettings) -> dict[int, int]:
    return {pk: i for i, (pk, _) in enumerate(search_settings.sourceSettings.sources) if isinstance(pk, int)}


def get_enabled_source_pks(search_settings: SearchSettings) -> list[int]:
    return [pk for (pk, enabled) in search_settings.sourceSettings.sources if isinstance(pk, int) and enabled is True]


def get_enabled_languages(search_settings: SearchSettings) -> list[str]:
    return [
        parsed_language.alpha_2
        for language in search_settings.filterSettings.languages
        if (parsed_language := pycountry.languages.get(alpha_2=language)) is not None
    ]


def get_scaled_maximum_size(search_settings: SearchSettings) -> int:
    return search_settings.filterSettings.maximumSize * 1_000_000


def get_search(search_settings: SearchSettings, query: Optional[str], card_types: list[CardType]) -> CardSearch:
    """
    This is the core search function for MPC Autofill - queries Elasticsearch for `self` given `search_settings`
    and returns the list of corresponding `Card` identifiers.
    Expects that the search index exists. Since this function is called many times, it makes sense to check this
    once at the call site rather than in the body of this function.
    """

    # set up search - match the query and use the AND operator
    s = (
        CardSearch.search()
        .filter(
            Bool(
                should=Terms(source_pk=get_enabled_source_pks(search_settings=search_settings)),
                minimum_should_match=1,
            )
        )
        .filter(
            Range(
                dpi={
                    "gte": search_settings.filterSettings.minimumDPI,
                    "lte": search_settings.filterSettings.maximumDPI,
                }
            )
        )
        .filter(Range(size={"lte": get_scaled_maximum_size(search_settings=search_settings)}))
        .source(fields=["identifier", "source_pk", "searchq"])
    )
    if query:
        query_parsed = to_searchable(query)
        if search_settings.searchTypeSettings.fuzzySearch:
            match = Match(searchq_fuzzy={"query": query_parsed, "operator": "AND"})
        else:
            match = Match(searchq_precise={"query": query_parsed, "operator": "AND"})
        s = s.query(match)
    if card_types:
        s = s.filter(
            Bool(
                should=Terms(card_type=[card_type.value for card_type in card_types]),
                minimum_should_match=1,
            )
        )
    if search_settings.filterSettings.languages:
        s = s.filter(
            Bool(
                should=Terms(language=get_enabled_languages(search_settings=search_settings)),
                minimum_should_match=1,
            )
        )
    if search_settings.filterSettings.includesTags:
        s = s.filter(Bool(should=Terms(tags=search_settings.filterSettings.includesTags), minimum_should_match=1))
    if search_settings.filterSettings.excludesTags:
        s = s.filter(Bool(must_not=Terms(tags=search_settings.filterSettings.excludesTags)))
    return s


@elastic_connection
def retrieve_card_identifiers(query: Optional[str], card_type: CardType, search_settings: SearchSettings) -> list[str]:
    hits_iterable = (
        get_search(search_settings=search_settings, query=query, card_types=[card_type])
        .sort({"priority": {"order": "desc"}})
        .params(preserve_order=True)
        .scan()
    )
    source_order = get_source_order(search_settings=search_settings)
    return [result.identifier for result in sorted(hits_iterable, key=lambda result: source_order[result.source_pk])]


def retrieve_cardback_identifiers(search_settings: SearchSettings) -> list[str]:
    """
    Retrieve the IDs of all cardbacks in the database, possibly filtered by search settings.
    """

    cardbacks: list[str]
    order_by = ["-priority", "source__ordinal", "source__name", "name"]
    if search_settings.searchTypeSettings.filterCardbacks:
        # afaik, `~Q(pk__in=[])` is the best way to have an always-true filter
        language_filter = (
            Q(language__in=[lang.upper() for lang in get_enabled_languages(search_settings)])
            if search_settings.filterSettings.languages
            else ~Q(pk__in=[])
        )
        includes_tag_filter = (
            (
                Q(tags__contains=search_settings.filterSettings.includesTags)
                | Q(tags__contained_by=search_settings.filterSettings.includesTags)
            )
            if search_settings.filterSettings.includesTags
            else ~Q(pk__in=[])
        )
        excludes_tag_filter = (
            ~Q(tags__overlap=search_settings.filterSettings.excludesTags)
            if search_settings.filterSettings.excludesTags
            else ~Q(pk__in=[])
        )
        source_order = get_source_order(search_settings=search_settings)
        hits_iterable = Card.objects.filter(
            language_filter,
            includes_tag_filter,
            excludes_tag_filter,
            card_type=CardTypes.CARDBACK,
            source__pk__in=get_enabled_source_pks(search_settings=search_settings),
            dpi__gte=search_settings.filterSettings.minimumDPI,
            dpi__lte=search_settings.filterSettings.maximumDPI,
            size__lte=get_scaled_maximum_size(search_settings=search_settings),
        ).order_by(*order_by)
        hits = sorted(hits_iterable, key=lambda card: source_order[card.source.pk])
        cardbacks = [card.identifier for card in hits]
    else:
        cardbacks = [card.identifier for card in Card.objects.filter(card_type=CardTypes.CARDBACK).order_by(*order_by)]
    return cardbacks


def get_new_cards_paginator(source: Source) -> Paginator[QuerySet[Card]]:
    now = timezone.now()
    cards = Card.objects.filter(
        source=source, date_created__lt=now, date_created__gte=now - dt.timedelta(days=NEW_CARDS_DAYS)
    ).order_by("-date_created", "name")
    return Paginator(cards, NEW_CARDS_PAGE_SIZE)  # type: ignore  # TODO: `_SupportsPagination`


__all__ = [
    "SearchExceptions",
    "get_elasticsearch_connection",
    "ping_elasticsearch",
    "elastic_connection",
    "get_search",
    "retrieve_card_identifiers",
    "retrieve_cardback_identifiers",
    "get_new_cards_paginator",
]
