import pytest
from requests import Response
from syrupy import SnapshotAssertion

from django.urls import reverse

from cardpicker import views
from cardpicker.tests.constants import Cards, Decks


def snapshot_response(response: Response, snapshot: SnapshotAssertion):
    try:
        assert {"status_code": response.status_code, "json": response.json()} == snapshot
    except ValueError:  # non-json response
        assert {"status_code": response.status_code, "content": response.content} == snapshot


class TestPostSearchResults:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass


class TestPostCards:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    def test_get_single_card(self, client, snapshot):
        response = client.post(
            reverse(views.post_cards),
            {"card_identifiers": [Cards.GOBLIN.value.identifier]},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)

    def test_get_multiple_cards(self, client, snapshot):
        response = client.post(
            reverse(views.post_cards),
            {"card_identifiers": [Cards.GOBLIN.value.identifier, Cards.DELVER_OF_SECRETS.value.identifier]},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)

    def test_request_card_not_in_the_database(self, client, snapshot):
        response = client.post(
            reverse(views.post_cards),
            {"card_identifiers": [Cards.GOBLIN.value.identifier, "i don't exist in the database"]},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)

    def test_response_to_malformed_card_identifier_list(self, client, snapshot):
        # TODO: this should probably return a different response for a malformed json body
        response = client.post(
            reverse(views.post_cards),
            {"card_identifiers": "i should be a list but i ain't"},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    def test_response_to_malformed_json_body(self, client, snapshot):
        # TODO: this should probably return a different response for a malformed json body
        response = client.post(
            reverse(views.post_cards), {"test": "i should be a json body but i ain't"}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetSources:
    def test_get_multiple_sources(self, client, snapshot, all_sources):
        response = client.get(reverse(views.get_sources))
        snapshot_response(response, snapshot)


class TestGetDFCPairs:
    def test_get_multiple_rows(self, client, snapshot, dfc_pairs):
        response = client.get(reverse(views.get_dfc_pairs))
        snapshot_response(response, snapshot)


class TestGetCardbacks:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    def test_get_multiple_rows(self, client, snapshot):
        response = client.get(reverse(views.get_cardbacks))
        snapshot_response(response, snapshot)


class TestGetImportSites:
    def test_get_multiple_sites(self, client, snapshot):
        response = client.get(reverse(views.get_import_sites))
        snapshot_response(response, snapshot)


class TestPostImportSiteDecklist:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    @pytest.mark.parametrize("url", [x.value for x in Decks])
    def test_valid_url(self, client, snapshot, url):
        response = client.post(reverse(views.post_import_site_decklist), {"url": url}, content_type="application/json")
        snapshot_response(response, snapshot)

    def test_invalid_url(self, client, snapshot):
        response = client.post(
            reverse(views.post_import_site_decklist), {"url": "https://garbage.com"}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    def test_malformed_json_body(self, client, snapshot):
        response = client.post(
            reverse(views.post_import_site_decklist),
            {"test": "garbage and garbage accessories"},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    def test_get_request(self, client, snapshot):
        response = client.get(reverse(views.post_import_site_decklist))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetSampleCards:
    def test_get_five_sample_cards(
        self,
        client,
        django_settings,
        elasticsearch,
        all_sources,
        # the endpoint should consistently return exactly these five cards (in a random order)
        brainstorm,
        island,
        island_classical,
        past_in_flames_1,
        goblin,
        snapshot,
    ):
        response = client.get(reverse(views.get_sample_cards))
        assert response.status_code == 200
        json_body = response.json()
        assert set(json_body.keys()) == {"cards"}
        assert set(json_body["cards"].keys()) == {"CARD", "TOKEN"}
        # the view returns a list of cards, but the order of the cards is deliberately random
        # keying the data by card name in this way should result in deterministic snapshotting
        assert {
            card_type: {row["name"]: row for row in sorted(cards, key=lambda x: x["name"])}
            for card_type, cards in json_body["cards"].items()
        } == snapshot

    def test_get_no_cards(self, client, django_settings, elasticsearch, all_sources, snapshot):
        response = client.get(reverse(views.get_sample_cards))
        assert response.status_code == 200
        assert response.json()["cards"] == {"CARD": [], "TOKEN": []}

    def test_get_three_cards_one_token(
        self,
        client,
        django_settings,
        elasticsearch,
        all_sources,
        brainstorm,
        island,
        island_classical,
        goblin,
        snapshot,
    ):
        response = client.get(reverse(views.get_sample_cards))
        assert response.status_code == 200
        json_body = response.json()
        assert len(json_body["cards"]["CARD"]) == 3
        assert len(json_body["cards"]["TOKEN"]) == 1

    def test_get_four_cards_zero_tokens(
        self,
        client,
        django_settings,
        elasticsearch,
        all_sources,
        brainstorm,
        island,
        island_classical,
        past_in_flames_1,
        snapshot,
    ):
        response = client.get(reverse(views.get_sample_cards))
        assert response.status_code == 200
        json_body = response.json()
        assert len(json_body["cards"]["CARD"]) == 4
        assert len(json_body["cards"]["TOKEN"]) == 0


class TestGetContributions:
    def test_get_multiple_rows(self, client, snapshot, all_sources, all_cards):
        response = client.get(reverse(views.get_contributions))
        snapshot_response(response, snapshot)

    def test_get_one_row(self, client, snapshot, example_drive_1, island, island_classical):
        response = client.get(reverse(views.get_contributions))
        snapshot_response(response, snapshot)

    def test_get_source_with_no_cards(self, client, snapshot, all_sources):
        response = client.get(reverse(views.get_contributions))
        snapshot_response(response, snapshot)

    def test_with_no_sources(self, client, snapshot, db):
        response = client.get(reverse(views.get_contributions))
        snapshot_response(response, snapshot)


class TestGetInfo:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    # TODO: write tests


class TestGetSearchEngineHealth:
    def test_elasticsearch_healthy(self, client, django_settings, elasticsearch, snapshot):
        response = client.get(reverse(views.get_search_engine_health))
        snapshot_response(response, snapshot)
        assert response.json()["online"] is True

    # TODO: consider how to test elasticsearch being unhealthy
