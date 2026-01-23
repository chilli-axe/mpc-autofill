import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from enum import Enum
from typing import Optional

import pytest
import requests_mock

from django.conf import settings as conf_settings

from cardpicker.integrations.game.mtg import MTG, Moxfield
from cardpicker.integrations.integrations import get_configured_game_integration


class TestGetIntegration:
    @pytest.mark.parametrize("environment_variable, integration_class", [("MTG", MTG)])
    def test_get_integration(self, db, environment_variable, integration_class, settings):
        settings.GAME = environment_variable
        assert get_configured_game_integration() == integration_class


class TestMTGIntegration:
    # region constants

    class Decks(Enum):
        # all of these decks have 4x brainstorm, 3x past in flames, and 1x delver of secrets // insectile aberration
        # AETHERHUB = "https://aetherhub.com/Deck/test-796905"
        # AETHERHUB_WITH_WWW = "https://www.aetherhub.com/Deck/test-796905"
        ARCHIDEKT = "https://archidekt.com/decks/3380653"
        ARCHIDEKT_WITH_WWW = "https://www.archidekt.com/decks/3380653"
        ARCHIDEKT_WITH_HASH = "https://archidekt.com/decks/3380653#test"
        ARCHIDEKT_WITH_SLASH = "https://archidekt.com/decks/3380653/test"
        CUBECOBRA = "https://cubecobra.com/cube/overview/2fj4"
        CUBECOBRA_WITH_WWW = "https://www.cubecobra.com/cube/overview/2fj4"
        # DECKSTATS = "https://deckstats.net/decks/216625/2754468-test"
        # DECKSTATS_WITH_WWW = "https://www.deckstats.net/decks/216625/2754468-test"
        MAGICVILLE = "https://magic-ville.com/fr/decks/showdeck?ref=948045"
        MAGICVILLE_WITH_WWW = "https://www.magic-ville.com/fr/decks/showdeck?ref=948045"
        MANASTACK = "https://manastack.com/deck/test-426"
        MOXFIELD = "https://www.moxfield.com/decks/D42-or9pCk-uMi4XzRDziQ"
        MOXFIELD_WITHOUT_WWW = "https://moxfield.com/decks/D42-or9pCk-uMi4XzRDziQ"
        MTGGOLDFISH = "https://www.mtggoldfish.com/deck/5149750"
        MTGGOLDFISH_WITHOUT_WWW = "https://mtggoldfish.com/deck/5149750"
        SCRYFALL = "https://scryfall.com/@mpcautofill/decks/71bb2d40-c922-4a01-a63e-7ba2dde29a5c"
        SCRYFALL_WITH_WWW = "https://www.scryfall.com/@mpcautofill/decks/71bb2d40-c922-4a01-a63e-7ba2dde29a5c"
        TAPPEDOUT = "https://tappedout.net/mtg-decks/09-10-22-DoY-test"
        TAPPEDOUT_WITH_WWW = "https://www.tappedout.net/mtg-decks/09-10-22-DoY-test"

    # endregion

    # region fixtures

    @pytest.fixture()
    def moxfield_secret_setter(self):
        def _callable(moxfield_secret: Optional[str]):
            conf_settings.MOXFIELD_SECRET = moxfield_secret

        old_secret = conf_settings.MOXFIELD_SECRET
        yield _callable
        conf_settings.MOXFIELD_SECRET = old_secret

    # endregion

    # region tests

    def test_get_double_faced_card_pairs(self):
        assert len(MTG.get_double_faced_card_pairs()) > 0

    def test_get_meld_pairs(self):
        assert len(MTG.get_meld_pairs()) > 0

    @pytest.mark.parametrize("url", [item.value for item in Decks], ids=[item.name.lower() for item in Decks])
    def test_valid_url(self, client, django_settings, snapshot, url: str):
        decklist = MTG.query_import_site(url)
        assert decklist
        assert Counter(decklist.splitlines()) == snapshot

    @pytest.mark.parametrize(
        "moxfield_secret, is_moxfield_enabled",
        [
            (None, False),
            ("", False),
            ("lorem ipsum", True),
        ],
    )
    def test_moxfield_enabled(self, moxfield_secret_setter, moxfield_secret, is_moxfield_enabled):
        moxfield_secret_setter(moxfield_secret)
        import_sites = MTG.get_import_sites()
        if is_moxfield_enabled:
            assert Moxfield in import_sites
        else:
            assert Moxfield not in import_sites

    def test_moxfield_rate_limit(self, monkeypatch):
        with requests_mock.Mocker() as mock:
            mock.get("https://api.moxfield.com/v2/decks/all/D42-or9pCk-uMi4XzRDziQ", json={})

            with ThreadPoolExecutor(max_workers=3) as pool:
                t0 = time.time()
                pool.map(lambda _: [Moxfield.retrieve_card_list(self.Decks.MOXFIELD.value) for _ in range(2)], range(3))
            t1 = time.time()
            t = t1 - t0
            assert t > 5  # one second between calls

    # endregion
