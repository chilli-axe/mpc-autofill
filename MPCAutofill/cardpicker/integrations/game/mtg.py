import html
import re
from typing import Any, Type
from urllib.parse import parse_qs, urlparse

import ratelimit

from django.conf import settings

from cardpicker.integrations.game.base import GameIntegration, ImportSite
from cardpicker.models import DFCPair
from cardpicker.utils import get_json_endpoint_rate_limited

# region import sites


class Aetherhub(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["aetherhub.com", "www.aetherhub.com"]

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        deck_id = path.split("-")[-1]
        if not deck_id:
            raise cls.InvalidURLException(url)
        return cls.request(path=f"Deck/MtgoDeckExport/{deck_id}").text


class Archidekt(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["archidekt.com", "www.archidekt.com"]

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        regex_results = re.compile(r"^/decks/(.+?)(?:[\#\/].*)?$").search(path)
        if regex_results is None:
            raise cls.InvalidURLException(url)
        deck_id = regex_results.groups()[0]
        if not deck_id:
            raise cls.InvalidURLException(url)
        response_json = cls.request(path=f"api/decks/{deck_id}/").json()
        return "\n".join([f"{x['quantity']} {x['card']['oracleCard']['name']}" for x in response_json["cards"]])


class CubeCobra(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["cubecobra.com", "www.cubecobra.com"]

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        cube_id = path.split("/")[-1]
        response = cls.request(
            path=(
                f"cube/download/plaintext/{cube_id}"
                f"?primary=Color%20Category"
                f"&secondary=Types-Multicolor&tertiary=Mana%20Value"
                f"&quaternary=Alphabetical"
                f"&showother=false"
            ),
            is_response_valid=lambda r: urlparse(r.url).path != "/404",
        )
        # filter out lines like `# mainboard` and `# maybeboard` which were recently introduced by cubecobra
        return "\n".join([x for x in response.text.split("\n") if not x.startswith("# ")])


class Deckstats(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["deckstats.net", "www.deckstats.net"]

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        regex_results = re.compile(r"^/decks/(\d*)/(\d*)").search(path)
        if regex_results is None:
            raise cls.InvalidURLException(url)
        owner_id, deck_id = regex_results.groups()
        if not owner_id or not deck_id:
            raise cls.InvalidURLException(url)
        response = cls.request(
            path=(
                f"api.php"
                f"?action=get_deck"
                f"&id_type=saved"
                f"&owner_id={owner_id}"
                f"&id={deck_id}"
                f"&response_type=list"
            )
        )
        card_list = response.json()["list"]
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
    def get_host_names() -> list[str]:
        return ["magic-ville.com", "www.magic-ville.com"]

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        qs = parse_qs(url)
        if len(qs) != 1 or len(qs[(key := list(qs.keys()).pop())]) != 1:
            raise cls.InvalidURLException(url)
        deck_id = qs[key].pop()
        response = cls.request(path=f"fr/decks/dl_appr?ref={deck_id}&save=1")
        card_list = response.text
        for x in ["// www.magic-ville.com deck file\r\n", "SB: "]:
            card_list = card_list.replace(x, "")
        if not card_list:
            raise cls.InvalidURLException(url)
        return card_list


class ManaStack(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["manastack.com"]  # www. is explicitly not valid

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        deck_id = path.split("/")[-1]
        if not deck_id:
            raise cls.InvalidURLException(url)
        response = cls.request(path=f"api/deck/list?slug={deck_id}")
        response_json = response.json()
        card_list = "\n".join([f"{item['count']} {item['card']['name']}" for item in response_json["list"]["cards"]])
        return card_list


class Moxfield(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["www.moxfield.com", "moxfield.com"]  # moxfield prefers www.

    # Note: requests to the Moxfield API must be rate limited to one request per second.
    @classmethod
    @ratelimit.sleep_and_retry  # type: ignore  # `ratelimit` does not implement decorator typing correctly
    @ratelimit.limits(calls=1, period=1)  # type: ignore  # `ratelimit` does not implement decorator typing correctly
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        deck_id = path.split("/")[-1]
        response = cls.request(
            path=f"v2/decks/all/{deck_id}", netloc="api.moxfield.com", headers={"User-Agent": settings.MOXFIELD_SECRET}
        )
        response_json = response.json()
        card_list = ""
        for category in [
            "commanders",
            "companions",
            "mainboard",
            "sideboard",
            "maybeboard",
        ]:
            for name, info in response_json.get(category, {}).items():
                card_list += f"{info['quantity']} {name}\n"
        for token in response_json.get("tokens", []):
            if token["layout"] == "token":
                card_list += f"t:{token['name']}\n"
        return card_list


class MTGGoldfish(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["www.mtggoldfish.com", "mtggoldfish.com"]  # mtggoldfish prefers www.

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        deck_id = path.split("#")[0].split("/")[-1]
        if not deck_id:
            raise cls.InvalidURLException(url)
        response = cls.request(path=f"deck/download/{deck_id}")
        return response.text


class Scryfall(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["scryfall.com", "www.scryfall.com"]

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        deck_id = path.rsplit("#", 1)[0].split("/")[-1]
        if not deck_id:
            raise cls.InvalidURLException(url)
        response = cls.request(path=f"decks/{deck_id}/export/text", netloc="api.scryfall.com")
        card_list = response.text
        for line_to_remove in ["// Sideboard"]:
            card_list = card_list.replace(line_to_remove, "")
        return card_list


class TappedOut(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["tappedout.net", "www.tappedout.net"]

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        path = urlparse(url).path
        response = cls.request(path=f"{path}?fmt=txt")
        card_list = response.content.decode("utf-8")
        for line_to_remove in ["Sideboard:\r\n"]:
            card_list = card_list.replace(line_to_remove, "")
        return card_list


class TCGPlayer(ImportSite):
    @staticmethod
    def get_host_names() -> list[str]:
        return ["decks.tcgplayer.com"]  # www. is explicitly not valid

    @classmethod
    def retrieve_card_list(cls, url: str) -> str:
        # TCGPlayer doesn't expose a useful API, so we need to parse the html directly
        path = urlparse(url).path
        response = cls.request(
            path=path,
            # TCGPlayer now requires that `User-Agent` is passed through.
            # the TCGPlayer deckbuilder is no longer supported, so this bandaid solution will only live
            # until the deckbuilder is fully killed off. see PR #292 on GitHub.
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0"},
        )
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
            *([Moxfield] if settings.MOXFIELD_SECRET else []),
            MTGGoldfish,
            Scryfall,
            TappedOut,
            TCGPlayer,
        ]

    # endregion


__all__ = ["MTG"]
