import json
import re
from dataclasses import dataclass

import requests


class LinkInputErrors:
    class SiteNotSupportedException(Exception):
        def __init__(self, url):
            self.message = (
                f"Importing card lists from {url} is not supported. Sorry about that!"
            )
            super().__init__(self.message)

    class InvalidURLException(Exception):
        def __init__(self, site, url):
            self.message = (
                f"There was a problem with importing your list from {site} at URL {url}. "
                f"Check that your URL is correct and try again."
            )
            super().__init__(self.message)


@dataclass
class ImportSite:
    name: str
    base_url: str

    def retrieve_card_list(self, url: str) -> str:
        raise NotImplementedError


class Aetherhub(ImportSite):
    def __init__(self):
        self.name = "Aetherhub"
        self.base_url = "https://aetherhub.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.split("-")[-1]
        response = requests.get(f"{self.base_url}/Deck/MtgoDeckExport/{deck_id}")
        if response.status_code == 404 or not deck_id:
            raise LinkInputErrors.InvalidURLException(self.name, url)
        return response.content.decode("utf-8")


class Archidekt(ImportSite):
    def __init__(self):
        self.name = "Archidekt"
        self.base_url = "https://archidekt.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.rsplit("#", 1)[0].split("/")[-1]
        response = requests.get(f"{self.base_url}/api/decks/{deck_id}/small/")
        if response.status_code == 404 or not deck_id:
            raise LinkInputErrors.InvalidURLException(self.name, url)
        response_json = json.loads(response.content.decode("utf-8"))
        card_list = ""
        for x in response_json["cards"]:
            card_list += f"{x['quantity']} {x['card']['oracleCard']['name']}\n"
        return card_list


class CubeCobra(ImportSite):
    def __init__(self):
        self.name = "CubeCobra"
        self.base_url = "https://cubecobra.com"

    def retrieve_card_list(self, url: str) -> str:
        cube_id = url.split("/")[-1]
        response = requests.get(
            f"{self.base_url}/cube/download/plaintext/{cube_id}?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=false"
        )
        if (
            response.url == "https://cubecobra.com/404" or not cube_id
        ):  # cubecobra returns code 200 for 404 page
            raise LinkInputErrors.InvalidURLException(self.name, url)
        return response.content.decode("utf-8")


class Deckstats(ImportSite):
    def __init__(self):
        self.name = "Deckstats"
        self.base_url = "https://deckstats.net"

    def retrieve_card_list(self, url: str) -> str:
        owner_id, deck_id = (
            re.compile(rf"^{self.base_url}/decks/(\d*)/(\d*)").search(url).groups()
        )
        response = requests.get(
            f"{self.base_url}/api.php?action=get_deck&id_type=saved&owner_id={owner_id}&id={deck_id}&response_type=list"
        )
        if response.status_code == 404 or not owner_id or not deck_id:
            raise LinkInputErrors.InvalidURLException(self.base_url, url)
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


class Moxfield(ImportSite):
    def __init__(self):
        self.name = "Moxfield"
        self.base_url = "https://www.moxfield.com"

    def retrieve_card_list(self, url: str) -> str:
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
    def __init__(self):
        self.name = "MTGGoldfish"
        self.base_url = "https://www.mtggoldfish.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.split("#")[0].split("/")[-1]
        response = requests.get(f"{self.base_url}/deck/download/{deck_id}")
        if response.status_code == 404 or not deck_id:
            raise LinkInputErrors.InvalidURLException(self.name, url)
        return response.content.decode("utf-8")


class Scryfall(ImportSite):
    def __init__(self):
        self.name = "Scryfall"
        self.base_url = "https://scryfall.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.rsplit("#", 1)[0].split("/")[-1]
        response = requests.get(f"https://api.scryfall.com/decks/{deck_id}/export/text")
        if response.status_code == 404 or not deck_id:
            raise LinkInputErrors.InvalidURLException(self.name, url)
        card_list = response.content.decode("utf-8")
        for x in ["// Sideboard"]:
            card_list = card_list.replace(x, "")
        return card_list


class TappedOut(ImportSite):
    def __init__(self):
        self.name = "TappedOut"
        self.base_url = "https://tappedout.net"

    def retrieve_card_list(self, url: str) -> str:
        response = requests.get(url + "?fmt=txt")
        if response.status_code == 404:
            raise LinkInputErrors.InvalidURLException(self.name, url)
        card_list = response.content.decode("utf-8")
        for x in ["Sideboard:\r\n"]:
            card_list = card_list.replace(x, "")
        return card_list


ImportSites = [
    Aetherhub,
    Archidekt,
    CubeCobra,
    Deckstats,
    Moxfield,
    MTGGoldfish,
    Scryfall,
    TappedOut,
]
