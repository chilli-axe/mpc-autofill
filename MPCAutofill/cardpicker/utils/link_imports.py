import html
import json
import re
from dataclasses import dataclass

import requests


@dataclass
class ImportSite:
    base_url: str

    def retrieve_card_list(self, url: str) -> str:
        """
        Takes a url pointing to a card list hosted on this class's site, queries the site's API / whatever for
        the card list, formats it and returns it.
        """

        raise NotImplementedError

    def InvalidURLException(self, url):
        return Exception(
            f"There was a problem with importing your list from {self.__class__.__name__} at URL {url}. "
            f"Check that your URL is correct and try again."
        )


class Aetherhub(ImportSite):
    def __init__(self):
        self.base_url = "https://aetherhub.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.split("-")[-1]
        response = requests.get(f"{self.base_url}/Deck/MtgoDeckExport/{deck_id}")
        if response.status_code == 404 or not deck_id:
            raise self.InvalidURLException(url)
        return response.content.decode("utf-8")


class Archidekt(ImportSite):
    def __init__(self):
        self.base_url = "https://archidekt.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.rsplit("#", 1)[0].split("/")[-1]
        response = requests.get(f"{self.base_url}/api/decks/{deck_id}/small/")
        if response.status_code == 404 or not deck_id:
            raise self.InvalidURLException(url)
        response_json = json.loads(response.content.decode("utf-8"))
        card_list = ""
        for x in response_json["cards"]:
            card_list += f"{x['quantity']} {x['card']['oracleCard']['name']}\n"
        return card_list


class CubeCobra(ImportSite):
    def __init__(self):
        self.base_url = "https://cubecobra.com"

    def retrieve_card_list(self, url: str) -> str:
        cube_id = url.split("/")[-1]
        response = requests.get(
            f"{self.base_url}/cube/download/plaintext/{cube_id}?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=false"
        )
        if (
            response.url == "https://cubecobra.com/404" or not cube_id
        ):  # cubecobra returns code 200 for 404 page
            raise self.InvalidURLException(url)
        return response.content.decode("utf-8")


class Deckstats(ImportSite):
    def __init__(self):
        self.base_url = "https://deckstats.net"

    def retrieve_card_list(self, url: str) -> str:
        owner_id, deck_id = (
            re.compile(rf"^{self.base_url}/decks/(\d*)/(\d*)").search(url).groups()
        )
        response = requests.get(
            f"{self.base_url}/api.php?action=get_deck&id_type=saved&owner_id={owner_id}&id={deck_id}&response_type=list"
        )
        if response.status_code == 404 or not owner_id or not deck_id:
            raise self.InvalidURLException(url)
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
    def __init__(self):
        self.base_url = "https://magic-ville.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.strip("#").split("=")[-1]
        response = requests.get(
            f"{self.base_url}/fr/decks/dl_appr?ref={deck_id}&save=1"
        )
        card_list = response.content.decode("utf-8")
        for x in ["// www.magic-ville.com deck file\r\n", "SB: "]:
            card_list = card_list.replace(x, "")
        if not deck_id or not card_list:
            raise self.InvalidURLException(url)
        return card_list


class ManaStack(ImportSite):
    def __init__(self):
        self.base_url = "https://manastack.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.split("/")[-1]
        response = requests.get(f"{self.base_url}/api/deck/list?slug={deck_id}")
        if response.status_code == 404 or not deck_id:
            raise self.InvalidURLException(url)
        response_json = json.loads(response.content.decode("utf-8"))
        card_list = ""
        for x in response_json["list"]["cards"]:
            card_list += f"{x['count']} {x['card']['name']}\n"
        return card_list


class Moxfield(ImportSite):
    def __init__(self):
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
        self.base_url = "https://www.mtggoldfish.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.split("#")[0].split("/")[-1]
        response = requests.get(f"{self.base_url}/deck/download/{deck_id}")
        if response.status_code == 404 or not deck_id:
            raise self.InvalidURLException(url)
        return response.content.decode("utf-8")


class Scryfall(ImportSite):
    def __init__(self):
        self.base_url = "https://scryfall.com"

    def retrieve_card_list(self, url: str) -> str:
        deck_id = url.rsplit("#", 1)[0].split("/")[-1]
        response = requests.get(f"https://api.scryfall.com/decks/{deck_id}/export/text")
        if response.status_code == 404 or not deck_id:
            raise self.InvalidURLException(url)
        card_list = response.content.decode("utf-8")
        for x in ["// Sideboard"]:
            card_list = card_list.replace(x, "")
        return card_list


class TappedOut(ImportSite):
    def __init__(self):
        self.base_url = "https://tappedout.net"

    def retrieve_card_list(self, url: str) -> str:
        response = requests.get(url + "?fmt=txt")
        if response.status_code == 404:
            raise self.InvalidURLException(url)
        card_list = response.content.decode("utf-8")
        for x in ["Sideboard:\r\n"]:
            card_list = card_list.replace(x, "")
        return card_list


class TcgPlayer(ImportSite):
    def __init__(self):
        self.base_url = "https://decks.tcgplayer.com/"

    def retrieve_card_list(self, url: str) -> str:
        # TCGPlayer doesn't expose a useful API, so we need to parse the html directly
        response = requests.get(url)
        if response.status_code == 404:
            raise self.InvalidURLException(url)
        cardTuple = re.findall(
            '<span class="subdeck-group__card-qty">(.+?)</span> '
            '<span class="subdeck-group__card-name">(.+?)</span>',
            response.text,
        )
        card_list = ""
        for qty, name in cardTuple:
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
    TcgPlayer,
]
