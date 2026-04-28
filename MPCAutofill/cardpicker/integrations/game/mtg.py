import concurrent.futures
import re
import time
import uuid
from pathlib import Path
from typing import Any, Type
from urllib.parse import parse_qs, urlparse

import enlighten
import imagehash
import ratelimit
import requests
from PIL import Image
from pydantic import BaseModel, ValidationError

from django.conf import settings

from cardpicker.integrations.game.base import GameIntegration, ImportSite
from cardpicker.models import (
    CanonicalArtist,
    CanonicalCard,
    CanonicalExpansion,
    DFCPair,
)
from cardpicker.schema_types import Game
from cardpicker.utils import (
    get_json_endpoint_rate_limited,
    section_timer,
    twos_complement,
)

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


# endregion


class BulkDataRow(BaseModel):
    object: str
    id: uuid.UUID
    type: str
    uri: str
    name: str
    description: str
    size: int
    download_uri: str
    content_type: str
    content_encoding: str


class BulkDataResponse(BaseModel):
    data: list[BulkDataRow]


class ImageURIs(BaseModel):
    small: str
    normal: str
    large: str
    png: str
    art_crop: str
    border_crop: str


class CardRow(BaseModel):
    id: uuid.UUID
    oracle_id: uuid.UUID | None = None
    name: str
    set: str
    collector_number: str
    artist: str
    image_uris: ImageURIs | None = None
    layout: str


class ExpansionRow(BaseModel):
    id: uuid.UUID
    code: str
    name: str


class ExpansionResponse(BaseModel):
    data: list[ExpansionRow]


class BulkDataURLs(BaseModel):
    default_cards: str
    oracle_cards: str


class MTGIntegration(GameIntegration):
    """
    Our Magic: The Gathering integration reads canonical card data from Scryfall and enables reading decklists from some
    popular deckbuilding sites.
    """

    DFC_SCRYFALL_QUERY = "is:dfc -layout:art_series -(layout:double_faced_token -keyword:transform) -is:reversible"
    MELD_SCRYFALL_QUERY = "is:meld"
    DFC_SCRYFALL_URL = f"https://api.scryfall.com/cards/search?q={DFC_SCRYFALL_QUERY}"
    MELD_SCRYFALL_URL = f"https://api.scryfall.com/cards/search?q={MELD_SCRYFALL_QUERY}"

    @classmethod
    def get_game(cls) -> Game:
        return Game.MTG

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
            # Aetherhub,  # broken by Cloudflare bot protection + they don't offer an API
            Archidekt,
            CubeCobra,
            # Deckstats,  # broken by Cloudflare bot protection
            MagicVille,
            ManaStack,
            *([Moxfield] if settings.MOXFIELD_SECRET else []),
            # MTGGoldfish,  # broken by Cloudflare bot protection
            Scryfall,
            TappedOut,
        ]

    @classmethod
    def get_canonical_cards_and_artists(cls) -> tuple[list[CanonicalCard], list[CanonicalArtist]]:
        artists_by_name: dict[str, CanonicalArtist] = {artist.name: artist for artist in CanonicalArtist.objects.all()}
        expansions_by_code: dict[str, CanonicalExpansion] = {
            expansion.code: expansion for expansion in CanonicalExpansion.objects.all()
        }
        new_cards_by_identifier: dict[uuid.UUID, CanonicalCard] = {}
        existing_card_identifiers = set(CanonicalCard.objects.values_list("identifier", flat=True))

        manager = enlighten.get_manager()
        default_cards_counter = manager.counter(desc="Default Cards", unit="ticks")
        oracle_cards_counter = manager.counter(desc="Oracle Cards", unit="ticks")

        cache_dir = Path(settings.BASE_DIR) / "scryfall_cache"
        default_cards_path = cache_dir / "default_cards.json"
        oracle_cards_path = cache_dir / "oracle_cards.json"

        def is_stale(path: Path) -> bool:
            return not path.exists() or time.time() - path.stat().st_mtime > 7 * 24 * 3600

        @section_timer(name="get bulk data URLs")
        def get_bulk_data_urls() -> BulkDataURLs:
            response = requests.get("https://api.scryfall.com/bulk-data")
            assert response.status_code == 200
            validated_response = BulkDataResponse.model_validate_json(response.text)
            default_cards = [entry for entry in validated_response.data if entry.type == "default_cards"].pop()
            oracle_cards = [entry for entry in validated_response.data if entry.type == "oracle_cards"].pop()
            assert default_cards is not None
            assert oracle_cards is not None
            return BulkDataURLs(
                default_cards=default_cards.download_uri,
                oracle_cards=oracle_cards.download_uri,
            )

        @section_timer(name="cache default cards")
        def cache_default_cards(url: str) -> None:
            if not is_stale(default_cards_path):
                print(f"Using cached default cards at {default_cards_path}")
                return
            cache_dir.mkdir(parents=True, exist_ok=True)
            print(f"Downloading default cards from {url}")
            with requests.get(url, stream=True) as r:
                with open(default_cards_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)

        @section_timer(name="cache oracle cards")
        def cache_oracle_cards(url: str) -> None:
            if not is_stale(oracle_cards_path):
                print(f"Using cached oracle cards at {oracle_cards_path}")
                return
            cache_dir.mkdir(parents=True, exist_ok=True)
            print(f"Downloading oracle cards from {url}")
            with requests.get(url, stream=True) as r:
                with open(oracle_cards_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)

        def row_to_canonical_card(row: CardRow) -> CanonicalCard | None:
            try:
                if row.layout == "art_series":
                    return None

                artist_name = row.artist
                if artist_name not in artists_by_name.keys():
                    artists_by_name[artist_name] = CanonicalArtist(name=artist_name)

                image_hash_int: int | None = None
                if row.image_uris is not None:
                    try:
                        im = Image.open(requests.get(row.image_uris.small, stream=True).raw)
                        image_hash = str(imagehash.phash(im))
                        image_hash_int = twos_complement(image_hash, 64)
                    except Exception as e:
                        print(f"encountered exception while computing image hash: {e}")

                return CanonicalCard(
                    identifier=row.id,
                    canonical_id=row.oracle_id,
                    name=row.name,
                    expansion=expansions_by_code[row.set],
                    artist=artists_by_name[artist_name],
                    collector_number=row.collector_number,
                    is_default=False,
                    image_hash=image_hash_int if image_hash_int is not None else 0,
                    small_thumbnail_url=row.image_uris.small if row.image_uris else "",
                    medium_thumbnail_url=row.image_uris.normal if row.image_uris else "",
                )
            except Exception as e:
                # overly safe exception handling to prevent threads from silently dying
                print(f"encountered exception in CanonicalCard transformation thread: {e}")
                return None

        def process_row(
            row: CardRow, pool: concurrent.futures.ThreadPoolExecutor, mark_existing_as_default: bool
        ) -> None:
            if mark_existing_as_default and row.id in new_cards_by_identifier.keys():
                new_cards_by_identifier[row.id].is_default = True
            elif row.id not in existing_card_identifiers:
                future = pool.submit(row_to_canonical_card, row)
                card = future.result()
                if card:
                    new_cards_by_identifier[row.id] = card

        def process_file(path: Path, counter: enlighten.Counter, mark_existing_as_default: bool) -> None:
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                with open(path, "rb") as f:
                    for line in f:
                        line = line.rstrip(b"\n")
                        if line in [b"[", b"]"]:
                            continue
                        decoded_line = line.decode("utf-8").rstrip(",")
                        try:
                            row = CardRow.model_validate_json(decoded_line)
                            process_row(row, pool, mark_existing_as_default=mark_existing_as_default)
                            counter.update()
                        except ValidationError:
                            print(f"failed to validate line: {decoded_line}")

        @section_timer(name="process default cards")
        def process_default_cards() -> None:
            process_file(default_cards_path, default_cards_counter, mark_existing_as_default=False)

        @section_timer("process oracle cards")
        def process_oracle_cards() -> None:
            process_file(default_cards_path, oracle_cards_counter, mark_existing_as_default=True)

        bulk_data_urls = get_bulk_data_urls()
        cache_default_cards(bulk_data_urls.default_cards)
        cache_oracle_cards(bulk_data_urls.oracle_cards)
        process_default_cards()
        process_oracle_cards()

        return list(new_cards_by_identifier.values()), list(artists_by_name.values())

    @classmethod
    def get_canonical_expansions(cls) -> list[CanonicalExpansion]:
        response = requests.get("https://api.scryfall.com/sets")
        assert response.status_code == 200
        parsed_response = ExpansionResponse.model_validate_json(response.text)
        expansions: list[CanonicalExpansion] = [
            CanonicalExpansion(
                identifier=row.id,
                code=row.code,
                name=row.name,
                game=cls.get_game(),
            )
            for row in parsed_response.data
        ]
        return expansions

    # endregion


__all__ = ["MTGIntegration"]
