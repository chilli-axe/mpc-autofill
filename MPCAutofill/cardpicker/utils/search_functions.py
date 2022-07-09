from datetime import timedelta
from typing import Any, Callable, Optional, Type, TypeVar, cast

from cardpicker.documents import CardbackSearch, CardSearch, TokenSearch
from cardpicker.utils.to_searchable import to_searchable
from django.http import HttpRequest
from django.utils import timezone
from elasticsearch.exceptions import ConnectionError as ElasticConnectionError
from elasticsearch_dsl.document import Document, Search
from elasticsearch_dsl.index import Index
from elasticsearch_dsl.query import Match
from Levenshtein import distance

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
    return search_database(drive_order, fuzzy_search, query, CardSearch)


@elastic_connection
def query_es_cardback() -> list[dict[str, Any]]:
    # return all cardbacks in the search index
    if not Index(CardbackSearch.Index.name).exists():
        raise SearchExceptions.IndexNotFoundException(CardbackSearch.__name__)
    s = CardbackSearch.search()
    hits = s.sort({"priority": {"order": "desc"}}).params(preserve_order=True).scan()
    results = [x.to_dict() for x in hits]
    return results


def query_es_token(drive_order: list[str], fuzzy_search: bool, query: str) -> list[dict[str, Any]]:
    return search_database(drive_order, fuzzy_search, query, TokenSearch)


@elastic_connection
def search_database(
    drive_order: list[str], fuzzy_search: bool, query: str, index: Type[Document]
) -> list[dict[str, Any]]:
    # search through the database for a given query, over the drives specified in drive_orders,
    # using the search index specified in s (this enables reuse of code between Card and Token search functions)
    if not Index(index.Index.name).exists():
        raise SearchExceptions.IndexNotFoundException(index.__name__)
    s = index.search()

    results = []

    query_parsed = to_searchable(query)

    # set up search - match the query and use the AND operator
    if fuzzy_search:
        match = Match(searchq={"query": query_parsed, "operator": "AND"})
    else:
        match = Match(searchq_keyword={"query": query_parsed, "operator": "AND"})
    s_query = s.query(match)
    hits = s_query.sort({"priority": {"order": "desc"}}).params(preserve_order=True).scan()
    hits_dict = [x.to_dict() for x in hits]

    if hits_dict:
        if fuzzy_search:
            hits_dict.sort(key=lambda x: distance(x["searchq"], query_parsed))
        for drive in drive_order:
            results += [x for x in hits_dict if x["source"] == drive]

    return results


def process_line(input_str: str) -> tuple[Optional[str], Optional[int]]:
    # Extract the quantity and card name from a given line of the text input
    input_str = str(" ".join([x for x in input_str.split(" ") if x]))
    if input_str.isspace() or len(input_str) == 0:
        return None, None
    num_idx = 0
    input_str = input_str.replace("//", "&").replace("/", "&")
    while True:
        if num_idx >= len(input_str):
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
