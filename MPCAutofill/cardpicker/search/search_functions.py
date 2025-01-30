import datetime as dt
import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional, TypeVar, cast

import pycountry
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import ConnectionError as ElasticConnectionError
from elasticsearch_dsl.query import Bool, Match, Range, Term, Terms
from jsonschema import Draft201909Validator
from referencing import Registry, Resource

from django.conf import settings
from django.core.paginator import Paginator
from django.db.models import Q, QuerySet
from django.utils import timezone

from cardpicker.constants import (
    NEW_CARDS_DAYS,
    NEW_CARDS_PAGE_SIZE,
    SEARCH_RESULTS_PAGE_SIZE,
)
from cardpicker.documents import CardSearch
from cardpicker.models import Card, CardTypes, Source
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


# region new API


@dataclass(frozen=True, eq=True)
class SearchSettings:
    fuzzy_search: bool
    filter_cardbacks: bool
    sources: list[str]
    min_dpi: int
    max_dpi: int
    max_size: int  # number of bytes
    languages: list[pycountry.Languages]
    includes_tags: list[str]
    excludes_tags: list[str]

    @classmethod
    def from_json_body(cls, json_body: dict[str, Any]) -> "SearchSettings":
        """
        :param json_body: JSON body from the frontend to read settings from.
        :return: The parsed search settings.
        :raises: KeyError if data is missing. It's expected that `json_body` has been validated against the JSON schema.
        """

        schema_directory = get_schema_directory()
        registry = Registry[str]().with_resources(  # TODO: is this type annotation correct?
            [
                (
                    "search_settings.json",
                    Resource.from_contents(json.loads((schema_directory / "search_settings.json").read_text())),
                )
            ]
        )
        schema_validator = Draft201909Validator(
            {
                "$schema": "https://json-schema.org/draft/2019-09/schema",
                "$id": "search_data",
                "type": "object",
                "properties": {
                    "searchSettings": {"$ref": "search_settings.json"},
                },
                "required": ["searchSettings"],
                "allowAdditionalProperties": False,
            },
            registry=registry,  # type: ignore  # apparently this is an unexpected keyword argument
        )

        # the below line may raise ValidationError
        schema_validator.validate(json_body)

        search_settings = json_body["searchSettings"]
        search_type_settings = search_settings["searchTypeSettings"]
        source_settings = search_settings["sourceSettings"]
        filter_settings = search_settings["filterSettings"]

        fuzzy_search = search_type_settings["fuzzySearch"] is True
        filter_cardbacks = search_type_settings["filterCardbacks"] is True

        source_lookup: dict[int, str] = {x.pk: x.key for x in Source.objects.all()}

        sources: list[str] = []
        if (card_source_keys := source_settings["sources"]) is not None:
            sources = [
                source_lookup[card_source_key]
                for card_source_key, card_source_enabled in card_source_keys
                if card_source_enabled and card_source_key in source_lookup.keys()
            ]

        min_dpi = int(filter_settings["minimumDPI"])
        max_dpi = int(filter_settings["maximumDPI"])
        max_size = int(filter_settings["maximumSize"]) * 1_000_000

        languages = [
            parsed_language
            for language in filter_settings["languages"]
            if (parsed_language := pycountry.languages.get(alpha_2=language)) is not None
        ]
        includes_tags = filter_settings["includesTags"]
        excludes_tags = filter_settings["excludesTags"]

        return cls(
            fuzzy_search=fuzzy_search,
            filter_cardbacks=filter_cardbacks,
            sources=sources,
            min_dpi=min_dpi,
            max_dpi=max_dpi,
            max_size=max_size,
            languages=languages,
            includes_tags=includes_tags,
            excludes_tags=excludes_tags,
        )

    def get_source_order(self) -> dict[str, int]:
        return {x: i for i, x in enumerate(self.sources)}

    def retrieve_cardback_identifiers(self) -> list[str]:
        """
        Retrieve the IDs of all cardbacks in the database, possibly filtered by search settings.
        """

        cardbacks: list[str]
        order_by = ["-priority", "source__ordinal", "source__name", "name"]
        if self.filter_cardbacks:
            # afaik, `~Q(pk__in=[])` is the best way to have an always-true filter
            language_filter = (
                Q(language__in=[language.alpha_2.upper() for language in self.languages])
                if self.languages
                else ~Q(pk__in=[])
            )
            includes_tag_filter = (
                (Q(tags__contains=self.includes_tags) | Q(tags__contained_by=self.includes_tags))
                if self.includes_tags
                else ~Q(pk__in=[])
            )
            excludes_tag_filter = ~Q(tags__overlap=self.excludes_tags) if self.excludes_tags else ~Q(pk__in=[])
            source_order = self.get_source_order()
            hits_iterable = Card.objects.filter(
                language_filter,
                includes_tag_filter,
                excludes_tag_filter,
                card_type=CardTypes.CARDBACK,
                source__key__in=self.sources,
                dpi__gte=self.min_dpi,
                dpi__lte=self.max_dpi,
                size__lte=self.max_size,
            ).order_by(*order_by)
            hits = sorted(hits_iterable, key=lambda card: source_order[card.source.key])
            cardbacks = [card.identifier for card in hits]
        else:
            cardbacks = [
                card.identifier for card in Card.objects.filter(card_type=CardTypes.CARDBACK).order_by(*order_by)
            ]
        return cardbacks


@dataclass(frozen=True, eq=True)
class SearchQuery:
    query: str
    card_type: CardTypes

    @classmethod
    def from_json_body(cls, json_body: dict[str, Any]) -> Optional["SearchQuery"]:
        """
        Private entry point. Generate an instance of this class from `json_body` (which is most likely a subset
        of a larger JSON body).
        """

        query = json_body.get("query", None)
        card_type = json_body.get("card_type", None)
        card_types = {str(x) for x in CardTypes}
        if query and card_type in card_types:
            return SearchQuery(query=query, card_type=CardTypes[card_type])
        return None

    @classmethod
    def list_from_json_body(cls, json_body: dict[str, Any]) -> list["SearchQuery"]:
        """
        Public entry point. Generate a list of instances of this class from `json_body`.
        :raises: KeyError if no queries are specified.
        """

        schema_directory = get_schema_directory()
        registry = Registry[str]().with_resources(  # TODO: is this type annotation correct?
            [
                (
                    "search_query.json",
                    Resource.from_contents(json.loads((schema_directory / "search_query.json").read_text())),
                )
            ]
            + [
                (
                    "search_queries.json",
                    Resource.from_contents(
                        {
                            "$schema": "https://json-schema.org/draft/2019-09/schema",
                            "$id": "search_queries.json",
                            "type": "array",
                            "items": [{"$ref": "search_query.json"}],
                            "maxItems": SEARCH_RESULTS_PAGE_SIZE,
                        }
                    ),
                )
            ]
        )
        schema_validator = Draft201909Validator(
            {
                "$schema": "https://json-schema.org/draft/2019-09/schema",
                "$id": "search_data",
                "type": "object",
                "properties": {
                    "queries": {"$ref": "search_queries.json"},
                },
                "required": ["searchSettings", "queries"],
                "allowAdditionalProperties": False,
            },
            registry=registry,  # type: ignore  # apparently this is an unexpected keyword argument
        )

        # the below line may raise ValidationError
        schema_validator.validate(json_body)

        # uniqueness of queries guaranteed
        query_dicts = json_body["queries"]
        queries = set()
        if query_dicts:
            for query_dict in query_dicts:
                query = cls.from_json_body(query_dict)
                if query is not None:
                    queries.add(query)
        return sorted(queries, key=lambda x: (x.query, x.card_type))

    @elastic_connection
    def retrieve_card_identifiers(self, search_settings: SearchSettings) -> list[str]:
        """
        This is the core search function for MPC Autofill - queries Elasticsearch for `self` given `search_settings`
        and returns the list of corresponding `Card` identifiers.
        Expects that the search index exists. Since this function is called many times, it makes sense to check this
        once at the call site rather than in the body of this function.
        """

        query_parsed = to_searchable(self.query)

        # set up search - match the query and use the AND operator
        if search_settings.fuzzy_search:
            match = Match(searchq_fuzzy={"query": query_parsed, "operator": "AND"})
        else:
            match = Match(searchq_precise={"query": query_parsed, "operator": "AND"})

        s = (
            CardSearch.search()
            .filter(Term(card_type=self.card_type))
            .filter(Bool(should=Terms(source=search_settings.sources), minimum_should_match=1))
            .filter(Range(dpi={"gte": search_settings.min_dpi, "lte": search_settings.max_dpi}))
            .filter(Range(size={"lte": search_settings.max_size}))
            .query(match)
            .sort({"priority": {"order": "desc"}})
            .source(fields=["identifier", "source", "searchq"])
        )
        if search_settings.languages:
            s = s.filter(
                Bool(
                    should=Terms(language=[language.alpha_2 for language in search_settings.languages]),
                    minimum_should_match=1,
                )
            )
        if search_settings.includes_tags:
            s = s.filter(Bool(should=Terms(tags=search_settings.includes_tags), minimum_should_match=1))
        if search_settings.excludes_tags:
            s = s.filter(Bool(must_not=Terms(tags=search_settings.excludes_tags)))
        hits_iterable = s.params(preserve_order=True).scan()

        source_order = search_settings.get_source_order()
        return [result.identifier for result in sorted(hits_iterable, key=lambda result: source_order[result.source])]


def get_schema_directory() -> Path:
    return Path(__file__).parent.parent.parent.parent / "common" / "schemas"


def get_new_cards_paginator(source: Source) -> Paginator[QuerySet[Card]]:
    now = timezone.now()
    cards = Card.objects.filter(
        source=source, date__lt=now, date__gte=now - dt.timedelta(days=NEW_CARDS_DAYS)
    ).order_by("-date")
    return Paginator(cards, NEW_CARDS_PAGE_SIZE)  # type: ignore  # TODO: `_SupportsPagination`


# endregion

__all__ = [
    "SearchExceptions",
    "get_elasticsearch_connection",
    "ping_elasticsearch",
    "elastic_connection",
    "SearchSettings",
    "SearchQuery",
    "get_schema_directory",
    "get_new_cards_paginator",
]
