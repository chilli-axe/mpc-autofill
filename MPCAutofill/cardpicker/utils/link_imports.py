import html
import json
import re
from abc import ABC

import requests


class InvalidURLException(Exception):
    def __init__(self, import_site_name: str, url: str):
        super().__init__(
            f"There was a problem with importing your list from {import_site_name} at URL {url}. "
            f"Check that your URL is correct and try again."
        )


class ImportSite(ABC):
    @staticmethod
    def get_base_url() -> str:
        """
        Returns the base URL for this import site, e.g. "https://google.com"
        """

        raise NotImplementedError

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        """
        Takes a URL pointing to a card list hosted on this class's site, queries the site's API / whatever for
        the card list, formats it and returns it.
        """

        raise NotImplementedError

    @classmethod
    def raise_invalid_url_exception(cls, url: str) -> None:
        raise InvalidURLException(import_site_name=cls.__name__, url=url)


class Aetherhub(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://aetherhub.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        deck_id = url.split("-")[-1]
        response = requests.get(f"{cls.get_base_url()}/Deck/MtgoDeckExport/{deck_id}")
        if response.status_code == 404 or not deck_id:
            cls.raise_invalid_url_exception(url)
        return response.content.decode("utf-8")


class Archidekt(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://archidekt.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        deck_id = url.rsplit("#", 1)[0].split("/")[-1]
        response = requests.get(f"{cls.get_base_url()}/api/decks/{deck_id}/small/")
        if response.status_code == 404 or not deck_id:
            cls.raise_invalid_url_exception(url)
        response_json = json.loads(response.content.decode("utf-8"))
        card_list = ""
        for x in response_json["cards"]:
            card_list += f"{x['quantity']} {x['card']['oracleCard']['name']}\n"
        return card_list


class CubeCobra(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://cubecobra.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        cube_id = url.split("/")[-1]
        response = requests.get(
            f"{cls.get_base_url()}/cube/download/plaintext/{cube_id}?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=false"
        )
        if response.url == "https://cubecobra.com/404" or not cube_id:  # cubecobra returns code 200 for 404 page
            cls.raise_invalid_url_exception(url)
        # filter out lines like `# mainboard` and `# maybeboard` which were recently introduced by cubecobra
        return "\n".join([x for x in response.content.decode("utf-8").split("\n") if not x.startswith("# ")])


class Deckstats(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://deckstats.net"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        regex_results = re.compile(rf"^{cls.get_base_url()}/decks/(\d*)/(\d*)").search(url)
        if regex_results is None:
            cls.raise_invalid_url_exception(url)
            return ""  # only necessary so mypy understands the above function throws an exception
        owner_id, deck_id = regex_results.groups()
        response = requests.get(
            f"{cls.get_base_url()}/api.php?action=get_deck&id_type=saved&owner_id={owner_id}&id={deck_id}&response_type=list"
        )
        if response.status_code == 404 or not owner_id or not deck_id:
            cls.raise_invalid_url_exception(url)
        card_list = json.loads(response.content.decode("utf-8"))["list"]
        for x in [
            "//Main\n",
            "//Sideboard\n",
            "SB: ",
            "//Instant\n",
            "//Sorcery\n",
            "//Land\n",
            " # !Commander",
        ]:
            card_list = card_list.replace(x, "")
        return card_list


class MagicVille(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://magic-ville.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        deck_id = url.strip("#").split("=")[-1]
        response = requests.get(f"{cls.get_base_url()}/fr/decks/dl_appr?ref={deck_id}&save=1")
        card_list = response.content.decode("utf-8")
        for x in ["// www.magic-ville.com deck file\r\n", "SB: "]:
            card_list = card_list.replace(x, "")
        if not deck_id or not card_list:
            cls.raise_invalid_url_exception(url)
        return card_list


class ManaStack(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://manastack.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        deck_id = url.split("/")[-1]
        response = requests.get(f"{cls.get_base_url()}/api/deck/list?slug={deck_id}")
        if response.status_code == 404 or not deck_id:
            cls.raise_invalid_url_exception(url)
        response_json = json.loads(response.content.decode("utf-8"))
        card_list = ""
        for x in response_json["list"]["cards"]:
            card_list += f"{x['count']} {x['card']['name']}\n"
        return card_list


class Moxfield(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://www.moxfield.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        deck_id = url.split("/")[-1]
        response = requests.get(f"https://api.moxfield.com/v2/decks/all/{deck_id}")

        response_json = json.loads(response.content.decode("utf-8"))
        card_list = ""
        for category in [
            "commanders",
            "companions",
            "mainboard",
            "sideboard",
            "maybeboard",
        ]:
            for name, info in response_json[category].items():
                card_list += f"{info['quantity']} {name}\n"
        for token in response_json["tokens"]:
            if token["layout"] == "token":
                card_list += f"t:{token['name']}\n"
        return card_list


class MTGGoldfish(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://www.mtggoldfish.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        deck_id = url.split("#")[0].split("/")[-1]
        response = requests.get(f"{cls.get_base_url()}/deck/download/{deck_id}")
        if response.status_code == 404 or not deck_id:
            cls.raise_invalid_url_exception(url)
        return response.content.decode("utf-8")


class Scryfall(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://scryfall.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        deck_id = url.rsplit("#", 1)[0].split("/")[-1]
        response = requests.get(f"https://api.scryfall.com/decks/{deck_id}/export/text")
        if response.status_code == 404 or not deck_id:
            cls.raise_invalid_url_exception(url)
        card_list = response.content.decode("utf-8")
        for x in ["// Sideboard"]:
            card_list = card_list.replace(x, "")
        return card_list


class TappedOut(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://tappedout.net"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        response = requests.get(url + "?fmt=txt")
        if response.status_code == 404:
            cls.raise_invalid_url_exception(url)
        card_list = response.content.decode("utf-8")
        for x in ["Sideboard:\r\n"]:
            card_list = card_list.replace(x, "")
        return card_list


class TCGPlayer(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://decks.tcgplayer.com/"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        # TCGPlayer doesn't expose a useful API, so we need to parse the html directly
        response = requests.get(url)
        if response.status_code == 404:
            cls.raise_invalid_url_exception(url)
        card_tuple = re.findall(
            '<span class="subdeck-group__card-qty">(.+?)</span> ' '<span class="subdeck-group__card-name">(.+?)</span>',
            response.text,
        )
        card_list = ""
        for qty, name in card_tuple:
            card_list += "{} {}\n".format(qty, html.unescape(name))
        return card_list


ImportSites = [
    Aetherhub,
    Archidekt,
    CubeCobra,
    Deckstats,
    MagicVille,
    ManaStack,
    Moxfield,
    MTGGoldfish,
    Scryfall,
    TappedOut,
    TCGPlayer,
]
