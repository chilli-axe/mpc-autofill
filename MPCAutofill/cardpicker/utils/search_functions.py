import threading
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Callable, Optional, TypeVar, Union, cast

from elasticsearch import Elasticsearch
from elasticsearch.exceptions import ConnectionError as ElasticConnectionError
from elasticsearch_dsl.document import Search
from elasticsearch_dsl.index import Index
from elasticsearch_dsl.query import Bool, Match, Term, Terms
from Levenshtein import distance

from django.conf import settings
from django.http import HttpRequest
from django.utils import timezone

from cardpicker.constants import PAGE_SIZE
from cardpicker.documents import CardSearch
from cardpicker.models import CardTypes, Source
from cardpicker.utils.sanitisation import to_searchable

thread_local = threading.local()  # Should only be called once per thread

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


class SearchExceptions:
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
        es = Elasticsearch([settings.ELASTICSEARCH_HOST], port=9200)
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


# region old API
def build_context(drive_order: list[str], fuzzy_search: bool, order: dict[str, Any], qty: int) -> dict[str, Any]:
    context = {
        "drive_order": drive_order,
        "fuzzy_search": "true" if fuzzy_search else "false",
        "order": order,
        "qty": qty,
    }

    return context


def retrieve_search_settings(request: HttpRequest) -> tuple[list[str], bool]:
    # safely retrieve drive_order and fuzzy_search from request, given that sometimes
    # they might not exist, and trying to manipulate None objects results in exceptions
    drive_order = []
    if (drive_order_string := request.POST.get("drive_order")) is not None:
        drive_order = drive_order_string.split(",")
    fuzzy_search = False
    if (fuzzy_search_string := request.POST.get("fuzzy_search")) is not None:
        fuzzy_search = fuzzy_search_string == "true"
    return drive_order, fuzzy_search


def text_to_list(input_text: str) -> list[int]:
    # Helper function to translate strings like "[2, 4, 5, 6]" into lists
    if input_text == "":
        return []
    return [int(x) for x in input_text.strip("][").replace(" ", "").split(",")]


def query_es_card(drive_order: list[str], fuzzy_search: bool, query: str) -> list[dict[str, Any]]:
    return search_database(drive_order, fuzzy_search, query, CardTypes.CARD)


@elastic_connection
def query_es_cardback() -> list[dict[str, Any]]:
    # return all cardbacks in the search index
    if not Index(CardSearch.Index.name).exists():
        raise SearchExceptions.IndexNotFoundException(CardSearch.__name__)
    s = CardSearch.search()
    hits = (
        s.filter(Term(card_type=CardTypes.CARDBACK))
        .sort({"priority": {"order": "desc"}})
        .params(preserve_order=True)
        .scan()
    )
    results = [x.to_dict() for x in hits]
    return results


def query_es_token(drive_order: list[str], fuzzy_search: bool, query: str) -> list[dict[str, Any]]:
    return search_database(drive_order, fuzzy_search, query, CardTypes.TOKEN)


@elastic_connection
def search_database(
    drive_order: list[str], fuzzy_search: bool, query: str, card_type: CardTypes
) -> list[dict[str, Any]]:
    # search through the database for a given query, over the drives specified in drive_orders, filtering by `card_type`
    if not Index(CardSearch.Index.name).exists():
        raise SearchExceptions.IndexNotFoundException(CardSearch.__name__)
    s = (
        CardSearch.search()
        .filter(Term(card_type=card_type))
        .filter(Bool(should=Terms(source=drive_order), minimum_should_match=1))
    )

    query_parsed = to_searchable(query)

    # set up search - match the query and use the AND operator
    if fuzzy_search:
        match = Match(searchq={"query": query_parsed, "operator": "AND"})
    else:
        match = Match(searchq_keyword={"query": query_parsed, "operator": "AND"})

    s = s.query(match).sort({"priority": {"order": "desc"}})
    source_order = {x: i for i, x in enumerate(drive_order)}
    hits = [x.to_dict() for x in sorted(s.params(preserve_order=True).scan(), key=lambda x: source_order[x.source])]

    if fuzzy_search:
        hits.sort(key=lambda x: distance(x["searchq"], query_parsed))

    return hits


@elastic_connection
def search_new_elasticsearch_definition() -> Search:
    days = 14
    dt_from = timezone.now() - timedelta(days=days)
    dt_to = timezone.now()
    return CardSearch().search().filter("range", date={"from": dt_from, "to": dt_to})


@elastic_connection
def search_new(s: Search, source_key: str, page: int = 0) -> dict[str, Any]:
    # define page size and the range to paginate with
    page_size = 6
    start_idx = page_size * page
    end_idx = page_size * (page + 1)

    # match the given source
    query = s.filter("match", source=source_key).sort({"date": {"order": "desc"}})

    # quantity related things
    qty = query.count()
    results = {"qty": qty}
    if qty > 0:
        # retrieve a page's worth of hits, and convert the results to dict for ez parsing in frontend
        results["hits"] = [x.to_dict() for x in query[start_idx:end_idx]]

    # let the frontend know whether to continue to show the load more button
    results["more"] = "false"
    if qty > end_idx:
        results["more"] = "true"

    return results


# endregion

# region new API


@dataclass(frozen=True, eq=True)
class SearchSettings:
    fuzzy_search: bool = field(default=False)
    card_sources: list[str] = field(default_factory=list)
    cardback_sources: list[str] = field(default_factory=list)
    min_dpi: Optional[int] = None
    max_dpi: Optional[int] = None

    @classmethod
    def from_json_body(cls, json_body: dict[str, Any]) -> "SearchSettings":
        search_settings = json_body.get("searchSettings", {})

        fuzzy_search = search_settings.get("fuzzySearch", False) is True

        sources: set[str] = {x.key for x in Source.objects.all()}

        card_sources: list[str] = []
        if (card_source_keys := search_settings.get("cardSources")) is not None:
            for card_source_key in card_source_keys:
                if card_source_key in sources:
                    card_sources.append(card_source_key)

        cardback_sources: list[str] = []
        if (cardback_source_keys := search_settings.get("cardbackSources")) is not None:
            for cardback_source_key in cardback_source_keys:
                if cardback_source_key in sources:
                    cardback_sources.append(cardback_source_key)

        min_dpi = None
        max_dpi = None
        min_dpi_string = search_settings.get("minDPI", None)
        max_dpi_string = search_settings.get("maxDPI", None)
        if min_dpi_string is not None and max_dpi_string is not None:
            min_dpi = min(int(min_dpi_string), 0)
            max_dpi = max(int(max_dpi_string), 2000)

        return cls(
            fuzzy_search=fuzzy_search,
            card_sources=card_sources,
            cardback_sources=cardback_sources,
            min_dpi=min_dpi,
            max_dpi=max_dpi,
        )


@dataclass(frozen=True, eq=True)
class SearchQuery:
    query: str
    card_type: CardTypes

    @classmethod
    def from_json_body(cls, json_body: dict[str, Any]) -> Optional["SearchQuery"]:
        query = json_body.get("query", None)
        card_type = json_body.get("card_type", None)
        card_types = {str(x) for x in CardTypes}
        if query and card_type in card_types:
            return SearchQuery(query=query, card_type=CardTypes[card_type])
        return None

    @classmethod
    def list_from_json_body(cls, json_body: dict[str, Any]) -> list["SearchQuery"]:
        # uniqueness of queries guaranteed
        query_dicts = json_body.get("queries", [])
        queries = set()
        if query_dicts:
            for query_dict in query_dicts:
                query = cls.from_json_body(query_dict)
                if query is not None:
                    queries.add(query)
        return sorted(queries, key=lambda x: (x.query, x.card_type))

    @elastic_connection
    def retrieve_card_identifiers(self, search_settings: SearchSettings) -> list[str]:
        if not Index(CardSearch.Index.name).exists():
            raise SearchExceptions.IndexNotFoundException(CardSearch.__name__)
        query_parsed = to_searchable(self.query)

        # set up search - match the query and use the AND operator
        if search_settings.fuzzy_search:
            match = Match(searchq={"query": query_parsed, "operator": "AND"})
        else:
            match = Match(searchq_keyword={"query": query_parsed, "operator": "AND"})

        s = (
            CardSearch.search()
            .filter(Term(card_type=self.card_type))
            .filter(Bool(should=Terms(source=search_settings.card_sources), minimum_should_match=1))
            .query(match)
            .sort({"priority": {"order": "desc"}})
            .source(fields=["identifier", "source", "searchq"])
        )
        hits_iterable = s.params(preserve_order=True).scan()

        source_order = {x: i for i, x in enumerate(search_settings.card_sources)}
        if search_settings.fuzzy_search:
            hits = sorted(hits_iterable, key=lambda x: (source_order[x.source], distance(x.searchq, query_parsed)))
        else:
            hits = sorted(hits_iterable, key=lambda x: source_order[x.source])

        return [x.identifier for x in hits]


# endregion
