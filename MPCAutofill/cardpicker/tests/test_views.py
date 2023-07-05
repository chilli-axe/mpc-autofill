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
    def test_get_dfc_pairs_get_multiple_rows(self, client, snapshot, dfc_pairs):
        response = client.get(reverse(views.get_dfc_pairs))
        assert response.json() == snapshot


class TestGetCardbacks:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    def test_get_cardbacks_get_multiple_rows(self, client, snapshot):
        response = client.get(reverse(views.get_cardbacks))
        assert response.json() == snapshot


class TestGetImportSites:
    def test_get_import_sites(self, client, snapshot):
        response = client.get(reverse(views.get_import_sites))
        assert response.json() == snapshot


class TestPostImportSiteDecklist:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    # TODO: write tests


class TestGetSampleCards:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    # TODO: write tests


class TestGetContributions:
    def test_get_contributions_get_multiple_rows(self, client, snapshot, all_sources, all_cards):
        response = client.get(reverse(views.get_contributions))
        assert response.json() == snapshot

    def test_get_contributions_get_one_row(self, client, snapshot, example_drive_1, island, island_classical):
        response = client.get(reverse(views.get_contributions))
        assert response.json() == snapshot

    def test_get_contributions_get_source_with_no_cards(self, client, snapshot, all_sources):
        response = client.get(reverse(views.get_contributions))
        assert response.json() == snapshot

    def test_get_contributions_get_source_with_no_sources(self, client, snapshot, db):
        response = client.get(reverse(views.get_contributions))
        assert response.json() == snapshot


class TestGetInfo:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    # TODO: write tests


class TestGetSearchEngineHealth:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    # TODO: write tests
