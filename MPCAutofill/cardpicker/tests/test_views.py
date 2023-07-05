import pytest

from django.urls import reverse

from cardpicker import views
from cardpicker.tests.constants import Cards


class TestPostSearchResults:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestPostCards:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    def test_post_cards_get_single_card(self, client, snapshot):
        response = client.post(
            reverse(views.post_cards),
            {"card_identifiers": [Cards.GOBLIN.value.identifier]},
            content_type="application/json",
        )
        assert response.json() == snapshot

    def test_post_cards_get_multiple_cards(self, client, snapshot):
        response = client.post(
            reverse(views.post_cards),
            {"card_identifiers": [Cards.GOBLIN.value.identifier, Cards.DELVER_OF_SECRETS.value.identifier]},
            content_type="application/json",
        )
        assert response.json() == snapshot


class TestGetSources:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    def test_get_sources_get_multiple_sources(self, client, snapshot):
        response = client.get(reverse(views.get_sources))
        assert response.json() == snapshot


class TestGetDFCPairs:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestGetCardbacks:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestGetImportSites:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestPostImportSiteDecklist:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestGetSampleCards:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestGetContributions:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestGetInfo:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestGetSearchEngineHealth:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass
