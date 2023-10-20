import html
import json
import re
from typing import Any, Type

import requests

from cardpicker.integrations.base import GameIntegration, ImportSite
from cardpicker.models import DFCPair
from cardpicker.utils import get_json_endpoint_rate_limited

# region import sites


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
        regex_results = re.compile(rf"^{cls.get_base_url()}/decks/(.+?)(?:[\#\/].*)?$").search(url)
        if regex_results is None:
            cls.raise_invalid_url_exception(url)
            return ""  # only necessary so mypy understands the above function throws an exception
        deck_id = regex_results.groups()[0]
        response = requests.get(f"{cls.get_base_url()}/api/decks/{deck_id}/small/")
        if response.status_code == 404 or not deck_id:
            cls.raise_invalid_url_exception(url)
        response_json = json.loads(response.content.decode("utf-8"))
        return "\n".join([f"{x['quantity']} {x['card']['oracleCard']['name']}" for x in response_json["cards"]])


class CubeCobra(ImportSite):
    @staticmethod
    def get_base_url() -> str:
        return "https://cubecobra.com"

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        cube_id = url.split("/")[-1]
        response = requests.get(
            f"{cls.get_base_url()}/cube/download/plaintext/{cube_id}"
            f"?primary=Color%20Category"
            f"&secondary=Types-Multicolor&tertiary=Mana%20Value"
            f"&quaternary=Alphabetical"
            f"&showother=false"
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
            f"{cls.get_base_url()}/api.php"
            f"?action=get_deck"
            f"&id_type=saved"
            f"&owner_id={owner_id}"
            f"&id={deck_id}"
            f"&response_type=list"
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


# endregion


class MTG(GameIntegration):
    """
    Our Magic: The Gathering integration reads DFC pairs from Scryfall and enables reading decklists from some
    popular deckbuilding sites.
    """

    DFC_SCRYFALL_QUERY = "is:dfc -layout:art_series -(layout:double_faced_token -keyword:transform) -is:reversible"
    MELD_SCRYFALL_QUERY = "is:meld"
    DFC_SCRYFALL_URL = f"https://api.scryfall.com/cards/search?q={DFC_SCRYFALL_QUERY}"
    MELD_SCRYFALL_URL = f"https://api.scryfall.com/cards/search?q={MELD_SCRYFALL_QUERY}"

    @classmethod
    def query_scryfall_paginated(cls, url: str) -> list[dict[str, Any]]:
        response = get_json_endpoint_rate_limited(url)
        data = response["data"]
        while response["has_more"]:
            response = get_json_endpoint_rate_limited(response["next_page"])
            data += response["data"]
        return data

    @classmethod
    def get_double_faced_card_pairs(cls) -> list[DFCPair]:
        # query data and construct objects for regular double-faced cards
        dfc_pairs: list[DFCPair] = []
        dfc_data = cls.query_scryfall_paginated(cls.DFC_SCRYFALL_URL)
        print(f"Identified {len(dfc_data)} double-faced cards")
        for item in dfc_data:
            if item["digital"] is True:
                continue
            front_name = item["card_faces"][0]["name"]
            back_name = item["card_faces"][1]["name"]
            dfc_pairs.append(DFCPair(front=front_name, back=back_name))
        return dfc_pairs

    @classmethod
    def get_meld_pairs(cls) -> list[DFCPair]:
        # query data and construct objects for meld pairs

        dfc_pairs: list[DFCPair] = []
        meld_data = cls.query_scryfall_paginated(cls.MELD_SCRYFALL_URL)
        print(f"Identified {len(meld_data)} meld pieces")
        for item in meld_data:
            if "all_parts" not in item:
                card_name = item["name"]
                print(f"Skipping {card_name} (missing key 'all_parts')")
                continue

            card_part_singleton_list = list(filter(lambda part: part["name"] == item["name"], item["all_parts"]))
            meld_result_singleton_list = list(
                filter(lambda part: part["component"] == "meld_result", item["all_parts"])
            )

            if len(card_part_singleton_list) != 1 or len(meld_result_singleton_list) != 1:
                continue

            card_part = card_part_singleton_list.pop()
            meld_result = meld_result_singleton_list.pop()["name"]
            if card_part["component"] == "meld_part":
                is_top = "\n(Melds with " not in item["oracle_text"]
                card_bit = "Top" if is_top else "Bottom"
                dfc_pairs.append(DFCPair(front=item["name"], back=f"{meld_result} {card_bit}"))

        return dfc_pairs

    # region implementation of abstract methods

    @classmethod
    def get_dfc_pairs(cls) -> list[DFCPair]:
        return cls.get_double_faced_card_pairs() + cls.get_meld_pairs()

    @classmethod
    def get_import_sites(cls) -> list[Type[ImportSite]]:
        return [
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

    # endregion


__all__ = ["MTG"]
