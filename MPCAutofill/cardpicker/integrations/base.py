from abc import ABC, abstractmethod
from typing import Any, Callable, Optional, Type
from urllib.parse import urljoin, urlparse

import requests

from cardpicker.models import DFCPair


def default_is_response_valid(response: requests.Response) -> bool:
    return response.status_code == 200


class ImportSite(ABC):
    """
    Abstract base class for an import site integration. These should facilitate importing a list of cards
    based on a supplied URL.
    """

    @staticmethod
    @abstractmethod
    def get_host_names() -> list[str]:
        """
        Returns the host names for this import site, e.g. ["google.com", "www.google.com"].
        """

        ...

    @classmethod
    @abstractmethod
    def retrieve_card_list(cls, url: str) -> str:
        """
        Takes a URL pointing to a card list hosted on this class's site, queries the site's API / whatever for
        the card list, formats it and returns it.
        """

        ...

    @classmethod
    def request(
        cls,
        path: str,
        method: str = "GET",
        is_response_valid: Callable[[requests.Response], bool] = default_is_response_valid,
        netloc: Optional[str] = None,
        headers: Optional[dict[str, Any]] = None,
    ) -> requests.Response:
        url = urljoin(f"https://{netloc or cls.get_host_names()[0]}", path)
        response = requests.request(url=url, method=method, headers=headers)
        if not is_response_valid(response):
            raise cls.InvalidURLException(url)
        return response

    class InvalidURLException(Exception):
        def __init__(self, url: str):
            super().__init__(
                f"There was a problem with importing your list from {self.__class__.__name__} at URL {url}. "
                f"Check that your URL is correct and try again."
            )


class GameIntegration(ABC):
    """
    Abstract base class for a game integration. These collect code to integrate with a specific card game
    to enrich the app and tailor it more closely to the community's expectations.
    """

    # region abstract methods

    @classmethod
    @abstractmethod
    def get_dfc_pairs(cls) -> list[DFCPair]:
        ...

    @classmethod
    @abstractmethod
    def get_import_sites(cls) -> list[Type[ImportSite]]:
        ...

    # endregion

    @classmethod
    def query_import_site(cls, url: Optional[str]) -> Optional[str]:
        if url is None:
            raise ValueError("No decklist URL provided.")
        netloc = urlparse(url).netloc
        for site in cls.get_import_sites():
            if netloc in site.get_host_names():
                text = site.retrieve_card_list(url)
                cleaned_text = "\n".join(
                    [stripped_line for line in text.split("\n") if len(stripped_line := line.strip()) > 0]
                )
                if len(cleaned_text) > 0:
                    return cleaned_text
        return None


__all__ = ["ImportSite", "GameIntegration"]
