from abc import ABC, abstractmethod
from typing import Optional, Type

from cardpicker.models import DFCPair


class InvalidURLException(Exception):
    def __init__(self, import_site_name: str, url: str):
        super().__init__(
            f"There was a problem with importing your list from {import_site_name} at URL {url}. "
            f"Check that your URL is correct and try again."
        )


class ImportSite(ABC):
    """
    Abstract base class for an import site integration. These should facilitate importing a list of cards
    based on a supplied URL.
    """

    @staticmethod
    @abstractmethod
    def get_base_url() -> str:
        """
        Returns the base URL for this import site, e.g. "https://google.com"
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
    def raise_invalid_url_exception(cls, url: str) -> None:
        raise InvalidURLException(import_site_name=cls.__name__, url=url)


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
        for site in cls.get_import_sites():
            if url.startswith(site.get_base_url()):
                text = site.retrieve_card_list(url)
                cleaned_text = "\n".join(
                    [stripped_line for line in text.split("\n") if len(stripped_line := line.strip()) > 0]
                )
                if len(cleaned_text) > 0:
                    return cleaned_text
        return None


__all__ = ["InvalidURLException", "ImportSite", "GameIntegration"]
