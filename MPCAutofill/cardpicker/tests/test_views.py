from collections import Counter
from copy import deepcopy

import pytest
from requests import Response
from syrupy import SnapshotAssertion

from django.urls import reverse

from cardpicker import views
from cardpicker.tests.constants import Cards, Decks, Sources


def snapshot_response(response: Response, snapshot: SnapshotAssertion):
    try:
        assert {"status_code": response.status_code, "json": response.json()} == snapshot
    except ValueError:  # non-json response
        assert {"status_code": response.status_code, "content": response.content} == snapshot


class TestPostSearchResults:
    BASE_SEARCH_SETTINGS = {
        "searchTypeSettings": {"fuzzySearch": False},
        "sourceSettings": {
            "sources": [[Sources.EXAMPLE_DRIVE_1.value.pk, True], [Sources.EXAMPLE_DRIVE_2.value.pk, True]]
        },
        "filterSettings": {"minimumDPI": 0, "maximumDPI": 1500, "maximumSize": 30},
    }

    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    def test_search_for_single_card(self, client, snapshot):
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": self.BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.BRAINSTORM.value.name, "card_type": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.BRAINSTORM.value.name]["CARD"] == [Cards.BRAINSTORM.value.identifier]

    def test_search_for_single_cardback(self, client, snapshot):
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": self.BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.SIMPLE_LOTUS.value.name, "card_type": "CARDBACK"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.SIMPLE_LOTUS.value.name]["CARDBACK"] == [
            Cards.SIMPLE_LOTUS.value.identifier
        ]

    def test_search_for_single_token(self, client, snapshot):
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": self.BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.GOBLIN.value.name, "card_type": "TOKEN"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.GOBLIN.value.name]["TOKEN"] == [Cards.GOBLIN.value.identifier]

    def test_complex_search(self, client, snapshot):
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": self.BASE_SEARCH_SETTINGS,
                "queries": [
                    {"query": Cards.BRAINSTORM.value.name, "card_type": "CARD"},
                    {"query": Cards.ISLAND.value.name, "card_type": "CARD"},
                    {"query": Cards.SIMPLE_CUBE.value.name, "card_type": "CARDBACK"},
                    {"query": Cards.SIMPLE_LOTUS.value.name, "card_type": "CARDBACK"},
                    {"query": Cards.GOBLIN.value.name, "card_type": "TOKEN"},
                ],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    def test_priority_ordering_in_search_results(self, client, snapshot):
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": self.BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.ISLAND.value.name, "card_type": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        # `Island` should be before `Island (Classical)` due to priority being given to names with no parentheses
        assert response.json()["results"][Cards.ISLAND.value.name]["CARD"] == [
            Cards.ISLAND.value.identifier,
            Cards.ISLAND_CLASSICAL.value.identifier,
        ]

    def test_search_for_card_with_versions_from_two_sources(self, client, snapshot):
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": self.BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "card_type": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == [
            Cards.PAST_IN_FLAMES_1.value.identifier,
            Cards.PAST_IN_FLAMES_2.value.identifier,
        ]

    def test_search_for_card_with_versions_from_two_sources_under_reversed_search_order(self, client, snapshot):
        search_settings = deepcopy(self.BASE_SEARCH_SETTINGS)
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_2.value.pk, True],
            [Sources.EXAMPLE_DRIVE_1.value.pk, True],
        ]
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "card_type": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == [
            Cards.PAST_IN_FLAMES_2.value.identifier,
            Cards.PAST_IN_FLAMES_1.value.identifier,
        ]

    def test_search_for_card_with_versions_from_two_sources_with_one_source_disabled(self, client, snapshot):
        search_settings = deepcopy(self.BASE_SEARCH_SETTINGS)
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_1.value.pk, True],
            [Sources.EXAMPLE_DRIVE_2.value.pk, False],
        ]
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "card_type": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == [
            Cards.PAST_IN_FLAMES_1.value.identifier
        ]

    def test_search_for_card_with_versions_from_two_sources_with_all_sources_disabled(self, client, snapshot):
        search_settings = deepcopy(self.BASE_SEARCH_SETTINGS)
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_1.value.pk, False],
            [Sources.EXAMPLE_DRIVE_2.value.pk, False],
        ]
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "card_type": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == []

    def test_fuzzy_search(self, client, snapshot):
        search_settings = deepcopy(self.BASE_SEARCH_SETTINGS)
        search_settings["searchTypeSettings"]["fuzzySearch"] = True
        response = client.post(
            reverse(views.post_search_results),
            {"searchSettings": search_settings, "queries": [{"query": "past in", "card_type": "CARD"}]},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"]["past in"]["CARD"] == [
            Cards.PAST_IN_FLAMES_1.value.identifier,
            Cards.PAST_IN_FLAMES_2.value.identifier,
        ]

    def test_minimum_dpi_yielding_no_search_results(self, client, snapshot):
        search_settings = deepcopy(self.BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["minimumDPI"] = 400
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.SIMPLE_CUBE.value.name, "card_type": "CARDBACK"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.SIMPLE_CUBE.value.name]["CARDBACK"] == []

    def test_maximum_dpi_yielding_no_search_results(self, client, snapshot):
        search_settings = deepcopy(self.BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["maximumDPI"] = 200
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.SIMPLE_CUBE.value.name, "card_type": "CARDBACK"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.SIMPLE_CUBE.value.name]["CARDBACK"] == []

    def test_minimum_dpi_yielding_fewer_search_results(self, client, snapshot):
        search_settings = deepcopy(self.BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["minimumDPI"] = 600
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "card_type": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == [
            Cards.PAST_IN_FLAMES_1.value.identifier
        ]

    def test_maximum_size_yielding_fewer_search_results(self, client, snapshot):
        search_settings = deepcopy(self.BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["maximumSize"] = 4
        response = client.post(
            reverse(views.post_search_results),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "card_type": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == [
            Cards.PAST_IN_FLAMES_2.value.identifier
        ]

    @pytest.mark.parametrize(
        "json_body",
        [
            {},
            ["test"],
            {"searchSettings": "test2", "queries": {"query_garbage": Cards.BRAINSTORM.value.name, "card_type": "CARD"}},
            {"garbage": "test", "searchSettings": BASE_SEARCH_SETTINGS},
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": {"query_garbage": Cards.BRAINSTORM.value.name, "card_type": "CARD"},
            },
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": {"query": Cards.BRAINSTORM.value.name, "card_type": "garbage"},
            },
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": {"query": Cards.BRAINSTORM.value.name, "card_type_garbage": "CARD"},
            },
        ],
        ids=[
            "empty json body",
            "gave it an array instead of an object",
            "search settings not specified",
            "queries not specified",
            "invalid query field name",
            "invalid card type",
            "invalid card type field name",
        ],
    )
    def test_response_to_malformed_json_body(self, client, snapshot, json_body):
        response = client.post(reverse(views.post_search_results), json_body, content_type="application/json")
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    def test_get_request(self, client, django_settings, snapshot):
        response = client.get(reverse(views.post_search_results))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestPostCards:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, django_settings, all_sources, all_cards):
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

    @pytest.mark.parametrize(
        "json_body",
        [{}, {"test": "i should be a json body but i ain't"}, {"card_identifiers": "i should be a list but i ain't"}],
        ids=["empty json body", "missing card_identifiers entry", "invalid card_identifiers value"],
    )
    def test_response_to_malformed_json_body(self, client, snapshot, json_body):
        response = client.post(reverse(views.post_cards), json_body, content_type="application/json")
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
    def autouse_populated_database(self, django_settings, all_sources, all_cards):
        pass

    def test_get_multiple_rows(self, client, snapshot):
        response = client.get(reverse(views.get_cardbacks))
        snapshot_response(response, snapshot)


class TestGetImportSites:
    def test_get_multiple_sites(self, client, snapshot):
        response = client.get(reverse(views.get_import_sites))
        snapshot_response(response, snapshot)


class TestPostImportSiteDecklist:
    @pytest.mark.parametrize("url", [x.value for x in Decks])
    def test_valid_url(self, client, django_settings, snapshot, url):
        response = client.post(reverse(views.post_import_site_decklist), {"url": url}, content_type="application/json")
        assert response.status_code == 200
        response_json = response.json()
        assert "cards" in response_json.keys()
        assert Counter(response_json["cards"].splitlines()) == snapshot

    def test_invalid_url(self, client, django_settings, snapshot):
        response = client.post(
            reverse(views.post_import_site_decklist), {"url": "https://garbage.com"}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    @pytest.mark.parametrize(
        "json_body",
        [{}, {"url": "garbage and garbage accessories"}, {"test": "garbage and garbage accessories"}],
        ids=["empty json body", "malformed url", "invalid url field name"],
    )
    def test_response_to_malformed_json_body(self, client, django_settings, snapshot, json_body):
        response = client.post(reverse(views.post_import_site_decklist), json_body, content_type="application/json")
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    def test_get_request(self, client, django_settings, snapshot):
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
