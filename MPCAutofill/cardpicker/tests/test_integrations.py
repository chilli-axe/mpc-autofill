from collections import Counter
from enum import Enum

import pytest

from cardpicker.integrations.integrations import get_configured_game_integration
from cardpicker.integrations.mtg import MTG


class TestGetIntegration:
    @pytest.mark.parametrize("environment_variable, integration_class", [("MTG", MTG)])
    def test_get_integration(self, db, environment_variable, integration_class, settings):
        settings.GAME = environment_variable
        assert get_configured_game_integration() == integration_class


class TestMTGIntegration:
    # region constants

    class Decks(str, Enum):
        # all of these decks have 4x brainstorm, 3x past in flames, and 1x delver of secrets // insectile aberration
        AETHER_HUB = "https://aetherhub.com/Deck/test-796905"
        ARCHIDEKT = "https://archidekt.com/decks/3380653"
        ARCHIDEKT_WITH_HASH = "https://archidekt.com/decks/3380653#test"
        ARCHIDEKT_WITH_SLASH = "https://archidekt.com/decks/3380653/test"
        CUBE_COBRA = "https://cubecobra.com/cube/overview/2fj4"
        DECK_STATS = "https://deckstats.net/decks/216625/2754468-test"
        MAGIC_VILLE = "https://magic-ville.com/fr/decks/showdeck?ref=948045"
        MANA_STACK = "https://manastack.com/deck/test-426"
        MOXFIELD = "https://www.moxfield.com/decks/D42-or9pCk-uMi4XzRDziQ"
        MTG_GOLDFISH = "https://www.mtggoldfish.com/deck/5149750"
        SCRYFALL = "https://scryfall.com/@mpcautofill/decks/71bb2d40-c922-4a01-a63e-7ba2dde29a5c"
        TAPPED_OUT = "https://tappedout.net/mtg-decks/09-10-22-DoY-test"
        TCG_PLAYER = "https://decks.tcgplayer.com/magic/standard/mpc-autofill/test/1398367"

        def __str__(self):
            return self.value

    # endregion

    # region tests

    def test_get_double_faced_card_pairs(self):
        assert len(MTG.get_double_faced_card_pairs()) > 0

    def test_get_meld_pairs(self):
        assert len(MTG.get_meld_pairs()) > 0

    @pytest.mark.parametrize("url", list(Decks))
    def test_valid_url(self, client, django_settings, snapshot, url):
        decklist = MTG.query_import_site(url)
        assert Counter(decklist.splitlines()) == snapshot

    # endregion
