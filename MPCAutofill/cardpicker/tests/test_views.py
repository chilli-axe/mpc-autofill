import datetime as dt
from collections import Counter
from copy import deepcopy

import freezegun
import pytest
from requests import Response
from syrupy import SnapshotAssertion

from django.urls import reverse

from cardpicker import views
from cardpicker.tests.constants import Cards, DummyImportSite, Sources
from cardpicker.tests.factories import SourceFactory


def snapshot_response(response: Response, snapshot: SnapshotAssertion):
    try:
        assert {"status_code": response.status_code, "json": response.json()} == snapshot
    except ValueError:  # non-json response
        assert {"status_code": response.status_code, "content": response.content} == snapshot


BASE_SEARCH_SETTINGS = {
    "searchTypeSettings": {"fuzzySearch": False, "filterCardbacks": False},
    "sourceSettings": {"sources": [[Sources.EXAMPLE_DRIVE_1.value.pk, True], [Sources.EXAMPLE_DRIVE_2.value.pk, True]]},
    "filterSettings": {
        "minimumDPI": 0,
        "maximumDPI": 1500,
        "maximumSize": 30,
        "languages": [],
        "includesTags": [],
        "excludesTags": [],
    },
}


class TestPostEditorSearchResults:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    def test_search_for_single_card(self, client, snapshot):
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.BRAINSTORM.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.BRAINSTORM.value.name]["CARD"] == [Cards.BRAINSTORM.value.identifier]

    def test_search_for_single_cardback(self, client, snapshot):
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.SIMPLE_LOTUS.value.name, "cardType": "CARDBACK"}],
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
            reverse(views.post_editor_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.GOBLIN.value.name, "cardType": "TOKEN"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.GOBLIN.value.name]["TOKEN"] == [Cards.GOBLIN.value.identifier]

    def test_complex_search(self, client, snapshot):
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": [
                    {"query": Cards.BRAINSTORM.value.name, "cardType": "CARD"},
                    {"query": Cards.ISLAND.value.name, "cardType": "CARD"},
                    {"query": Cards.SIMPLE_CUBE.value.name, "cardType": "CARDBACK"},
                    {"query": Cards.SIMPLE_LOTUS.value.name, "cardType": "CARDBACK"},
                    {"query": Cards.GOBLIN.value.name, "cardType": "TOKEN"},
                ],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    def test_priority_ordering_in_search_results(self, client, snapshot):
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.ISLAND.value.name, "cardType": "CARD"}],
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
            reverse(views.post_editor_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
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
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_2.value.pk, True],
            [Sources.EXAMPLE_DRIVE_1.value.pk, True],
        ]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
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
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_1.value.pk, True],
            [Sources.EXAMPLE_DRIVE_2.value.pk, False],
        ]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == [
            Cards.PAST_IN_FLAMES_1.value.identifier
        ]

    def test_search_for_card_with_versions_from_two_sources_with_all_sources_disabled(self, client, snapshot):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_1.value.pk, False],
            [Sources.EXAMPLE_DRIVE_2.value.pk, False],
        ]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == []

    def test_fuzzy_search(self, client, snapshot):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["searchTypeSettings"]["fuzzySearch"] = True
        response = client.post(
            reverse(views.post_editor_search),
            {"searchSettings": search_settings, "queries": [{"query": "past in", "cardType": "CARD"}]},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"]["past in"]["CARD"] == [
            Cards.PAST_IN_FLAMES_1.value.identifier,
            Cards.PAST_IN_FLAMES_2.value.identifier,
        ]

    def test_minimum_dpi_yielding_no_search_results(self, client, snapshot):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["minimumDPI"] = 400
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.SIMPLE_CUBE.value.name, "cardType": "CARDBACK"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.SIMPLE_CUBE.value.name]["CARDBACK"] == []

    def test_maximum_dpi_yielding_no_search_results(self, client, snapshot):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["maximumDPI"] = 200
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.SIMPLE_CUBE.value.name, "cardType": "CARDBACK"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.SIMPLE_CUBE.value.name]["CARDBACK"] == []

    def test_minimum_dpi_yielding_fewer_search_results(self, client, snapshot):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["minimumDPI"] = 600
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == [
            Cards.PAST_IN_FLAMES_1.value.identifier
        ]

    def test_maximum_size_yielding_fewer_search_results(self, client, snapshot):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["maximumSize"] = 4
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"] == [
            Cards.PAST_IN_FLAMES_2.value.identifier
        ]

    def test_get_one_row_filtered_one_language(self, client, snapshot, past_in_flames_1, past_in_flames_2):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["languages"] = ["EN"]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"]) == 1

    def test_get_multiple_rows_filtered_two_languages(self, client, snapshot, past_in_flames_1, past_in_flames_2):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["languages"] = ["EN", "DE"]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"]) == 2

    def test_get_one_row_filtered_includes_one_tag(
        self, client, snapshot, past_in_flames_1, past_in_flames_2, another_tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["includesTags"] = [another_tag_in_data.name]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"]) == 1

    def test_get_one_row_filtered_excludes_one_tag(
        self, client, snapshot, past_in_flames_1, past_in_flames_2, another_tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["excludesTags"] = [another_tag_in_data.name]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_2.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["results"][Cards.PAST_IN_FLAMES_2.value.name]["CARD"]) == 1

    def test_get_multiple_rows_filtered_includes_one_tag(
        self, client, snapshot, past_in_flames_1, past_in_flames_2, tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["includesTags"] = [tag_in_data.name]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"]) == 2

    def test_get_multiple_rows_filtered_includes_one_tag_and_excludes_another(
        self, client, snapshot, past_in_flames_1, past_in_flames_2, tag_in_data, another_tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["includesTags"] = [tag_in_data.name]
        search_settings["filterSettings"]["excludesTags"] = [another_tag_in_data.name]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"]) == 1

    def test_get_multiple_rows_filtered_includes_two_tags(
        self, client, snapshot, past_in_flames_1, past_in_flames_2, tag_in_data, another_tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["includesTags"] = [tag_in_data.name, another_tag_in_data.name]
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": search_settings,
                "queries": [{"query": Cards.PAST_IN_FLAMES_1.value.name, "cardType": "CARD"}],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["results"][Cards.PAST_IN_FLAMES_1.value.name]["CARD"]) == 2

    def test_page_equal_to_max_size(self, client, monkeypatch, snapshot):
        monkeypatch.setattr("cardpicker.views.EDITOR_SEARCH_MAX_QUERIES", 2)
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": [
                    {"query": Cards.BRAINSTORM.value.name, "cardType": "CARD"},
                    {"query": Cards.ISLAND.value.name, "cardType": "CARD"},
                ],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    def test_page_larger_than_max_size(self, client, monkeypatch, snapshot):
        monkeypatch.setattr("cardpicker.views.EDITOR_SEARCH_MAX_QUERIES", 2)
        response = client.post(
            reverse(views.post_editor_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": [
                    {"query": Cards.BRAINSTORM.value.name, "cardType": "CARD"},
                    {"query": Cards.ISLAND.value.name, "cardType": "CARD"},
                    {"query": Cards.SIMPLE_CUBE.value.name, "cardType": "CARDBACK"},
                ],
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    @pytest.mark.parametrize(
        "json_body",
        [
            {},
            ["test"],
            {"searchSettings": "test2", "queries": {"query_garbage": Cards.BRAINSTORM.value.name, "cardType": "CARD"}},
            {"garbage": "test", "searchSettings": BASE_SEARCH_SETTINGS},
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": {"query_garbage": Cards.BRAINSTORM.value.name, "cardType": "CARD"},
            },
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "queries": {"query": Cards.BRAINSTORM.value.name, "cardType": "garbage"},
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
        response = client.post(reverse(views.post_editor_search), json_body, content_type="application/json")
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    def test_get_request(self, client, django_settings, snapshot):
        response = client.get(reverse(views.post_editor_search))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestPostExploreSearchResults:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    @pytest.mark.parametrize(
        "query, card_types, sort_by, expected_cards",
        [
            pytest.param(
                None,
                [],
                "dateCreatedDescending",
                [
                    Cards.BRAINSTORM.value,
                    Cards.DELVER_OF_SECRETS.value,
                    Cards.GOBLIN.value,
                    Cards.HUNTMASTER_OF_THE_FELLS.value,
                    Cards.INSECTILE_ABERRATION.value,
                    Cards.ISLAND_CLASSICAL.value,
                    Cards.ISLAND.value,
                    Cards.MOUNTAIN.value,
                    Cards.PAST_IN_FLAMES_2.value,
                    Cards.PAST_IN_FLAMES_1.value,
                    Cards.RAVAGER_OF_THE_FELLS.value,
                    Cards.SIMPLE_CUBE.value,
                    Cards.SIMPLE_LOTUS.value,
                ],
                id="no query + no filter to card type",
            ),
            pytest.param(
                None,
                ["CARD"],
                "dateCreatedDescending",
                [
                    Cards.BRAINSTORM.value,
                    Cards.DELVER_OF_SECRETS.value,
                    Cards.HUNTMASTER_OF_THE_FELLS.value,
                    Cards.INSECTILE_ABERRATION.value,
                    Cards.ISLAND_CLASSICAL.value,
                    Cards.ISLAND.value,
                    Cards.MOUNTAIN.value,
                    Cards.PAST_IN_FLAMES_2.value,
                    Cards.PAST_IN_FLAMES_1.value,
                    Cards.RAVAGER_OF_THE_FELLS.value,
                ],
                id="no query + filter to card",
            ),
            pytest.param(
                Cards.BRAINSTORM.value.name,
                ["CARD"],
                "dateCreatedDescending",
                [Cards.BRAINSTORM.value],
                id="query + filter to card",
            ),
            pytest.param(
                Cards.SIMPLE_LOTUS.value.name,
                ["CARDBACK"],
                "dateCreatedDescending",
                [Cards.SIMPLE_LOTUS.value],
                id="query + filter to cardback",
            ),
            pytest.param(
                Cards.GOBLIN.value.name,
                ["TOKEN"],
                "dateCreatedDescending",
                [Cards.GOBLIN.value],
                id="query + filter to token",
            ),
            pytest.param(
                None,
                ["CARDBACK", "TOKEN"],
                "nameAscending",
                [Cards.GOBLIN.value, Cards.SIMPLE_CUBE.value, Cards.SIMPLE_LOTUS.value],
                id="filter to cardback + token",
            ),
            pytest.param(
                None,
                ["CARDBACK"],
                "nameAscending",
                [Cards.SIMPLE_CUBE.value, Cards.SIMPLE_LOTUS.value],
                id="sort by name ascending",
            ),
            pytest.param(
                None,
                ["CARDBACK"],
                "nameDescending",
                [Cards.SIMPLE_LOTUS.value, Cards.SIMPLE_CUBE.value],
                id="sort by name descending",
            ),
        ],
    )
    def test_explore_search(self, client, snapshot, query, card_types, sort_by, expected_cards):
        response = client.post(
            reverse(views.post_explore_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "query": query,
                "cardTypes": card_types,
                "sortBy": sort_by,
                "pageSize": 20,
                "pageStart": 0,
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        response_json = response.json()
        assert response_json["count"] == len(expected_cards)
        assert [item["identifier"] for item in response_json["cards"]] == [
            expected_card.identifier for expected_card in expected_cards
        ]

    @pytest.mark.parametrize(
        "page_start, page_size, expected_cards",
        [
            pytest.param(
                0,
                3,
                [Cards.BRAINSTORM.value, Cards.DELVER_OF_SECRETS.value, Cards.GOBLIN.value],
                id="first page",
            ),
            pytest.param(
                3,
                3,
                [Cards.HUNTMASTER_OF_THE_FELLS.value, Cards.INSECTILE_ABERRATION.value, Cards.ISLAND_CLASSICAL.value],
                id="second page",
            ),
            pytest.param(
                6,
                3,
                [Cards.ISLAND.value, Cards.MOUNTAIN.value, Cards.PAST_IN_FLAMES_2.value],
                id="third page",
            ),
            pytest.param(
                9,
                3,
                [Cards.PAST_IN_FLAMES_1.value, Cards.RAVAGER_OF_THE_FELLS.value, Cards.SIMPLE_CUBE.value],
                id="fourth page",
            ),
            pytest.param(
                12,
                3,
                [Cards.SIMPLE_LOTUS.value],
                id="fifth page",
            ),
            pytest.param(
                13,
                3,
                [],
                id="sixth? page - does not exist",
            ),
            pytest.param(
                100,
                3,
                [],
                id="page start 100 - greater than number of results",
            ),
        ],
    )
    def test_explore_search_pagination(self, client, monkeypatch, page_start, page_size, expected_cards):
        monkeypatch.setattr("cardpicker.views.EXPLORE_SEARCH_MAX_PAGE_SIZE", 3)
        response = client.post(
            reverse(views.post_explore_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "query": None,
                "cardTypes": [],
                "sortBy": "dateCreatedDescending",
                "pageSize": page_size,
                "pageStart": page_start,
            },
            content_type="application/json",
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json["count"] == 13
        assert [item["identifier"] for item in response_json["cards"]] == [
            expected_card.identifier for expected_card in expected_cards
        ]

    @pytest.mark.parametrize(
        "page_start, page_size",
        [
            pytest.param(-1, 3, id="negative page start"),
            pytest.param(0, 0, id="page size zero"),
            pytest.param(0, -1, id="page size negative"),
            pytest.param(0, 4, id="page size greater than max page size"),
        ],
    )
    def test_explore_search_invalid_pagination(self, client, monkeypatch, page_start, page_size):
        monkeypatch.setattr("cardpicker.views.EXPLORE_SEARCH_MAX_PAGE_SIZE", 3)
        response = client.post(
            reverse(views.post_explore_search),
            {
                "searchSettings": BASE_SEARCH_SETTINGS,
                "query": None,
                "cardTypes": [],
                "sortBy": "dateCreatedDescending",
                "pageSize": page_size,
                "pageStart": page_start,
            },
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_get_request(self, client, django_settings, snapshot):
        response = client.get(reverse(views.post_editor_search))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestPostCards:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, django_settings, all_sources, all_cards):
        pass

    def test_get_single_card(self, client, snapshot):
        response = client.post(
            reverse(views.post_cards),
            {"cardIdentifiers": [Cards.GOBLIN.value.identifier]},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)

    def test_get_multiple_cards(self, client, snapshot):
        response = client.post(
            reverse(views.post_cards),
            {"cardIdentifiers": [Cards.GOBLIN.value.identifier, Cards.DELVER_OF_SECRETS.value.identifier]},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)

    def test_request_card_not_in_the_database(self, client, snapshot):
        response = client.post(
            reverse(views.post_cards),
            {"cardIdentifiers": [Cards.GOBLIN.value.identifier, "i don't exist in the database"]},
            content_type="application/json",
        )
        snapshot_response(response, snapshot)

    def test_page_equal_to_max_size(self, client, monkeypatch, snapshot):
        monkeypatch.setattr("cardpicker.views.CARDS_PAGE_SIZE", 3)
        response = client.post(
            reverse(views.post_cards),
            {
                "cardIdentifiers": [
                    Cards.GOBLIN.value.identifier,
                    Cards.DELVER_OF_SECRETS.value.identifier,
                    Cards.HUNTMASTER_OF_THE_FELLS.value.identifier,
                ]
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    def test_page_larger_than_max_size(self, client, monkeypatch, snapshot):
        monkeypatch.setattr("cardpicker.views.CARDS_PAGE_SIZE", 2)
        response = client.post(
            reverse(views.post_cards),
            {
                "cardIdentifiers": [
                    Cards.GOBLIN.value.identifier,
                    Cards.DELVER_OF_SECRETS.value.identifier,
                    Cards.HUNTMASTER_OF_THE_FELLS.value.identifier,
                ]
            },
            content_type="application/json",
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    @pytest.mark.parametrize(
        "json_body",
        [{}, {"test": "i should be a json body but i ain't"}, {"cardIdentifiers": "i should be a list but i ain't"}],
        ids=["empty json body", "missing card_identifiers entry", "invalid card_identifiers value"],
    )
    def test_response_to_malformed_json_body(self, client, snapshot, json_body):
        response = client.post(reverse(views.post_cards), json_body, content_type="application/json")
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    def test_get_request(self, client, django_settings, snapshot):
        response = client.get(reverse(views.post_cards))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetSources:
    def test_get_multiple_sources(self, client, snapshot, all_sources):
        response = client.get(reverse(views.get_sources))
        snapshot_response(response, snapshot)

    def test_get_source_with_private_identifier(self, client, db):
        source = SourceFactory(identifier="secret", external_link=None)
        response = client.get(reverse(views.get_sources))
        response_json = response.json()
        assert len(response_json["results"]) == 1
        serialised_source = response_json["results"][str(source.pk)]
        for value in serialised_source.values():
            assert "secret" not in str(value)

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_sources))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetDFCPairs:
    def test_get_multiple_rows(self, client, snapshot, dfc_pairs):
        response = client.get(reverse(views.get_dfc_pairs))
        snapshot_response(response, snapshot)

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_dfc_pairs))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetLanguages:
    def test_get_zero_languages(self, client, django_settings):
        response = client.get(reverse(views.get_languages))
        assert response.json()["languages"] == []

    def test_get_one_language(self, client, django_settings, island_classical):
        response = client.get(reverse(views.get_languages))
        assert response.json()["languages"] == [{"name": "French", "code": "FR"}]

    def test_get_two_languages(self, client, django_settings, island, island_classical):
        response = client.get(reverse(views.get_languages))
        assert response.json()["languages"] == [{"name": "English", "code": "EN"}, {"name": "French", "code": "FR"}]

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_languages))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetTags:
    def test_get_no_data_tags(self, client, django_settings):
        response = client.get(reverse(views.get_tags))
        assert response.json()["tags"] == [
            {"name": "NSFW", "parent": None, "aliases": [], "children": [], "isEnabledByDefault": True},
        ]

    def test_get_one_data_tag(self, client, django_settings, tag_in_data):
        response = client.get(reverse(views.get_tags))
        assert response.json()["tags"] == [
            {"name": "NSFW", "parent": None, "aliases": [], "children": [], "isEnabledByDefault": True},
            {
                "name": "Tag in Data",
                "parent": None,
                "aliases": ["TaginData"],
                "children": [],
                "isEnabledByDefault": True,
            },
        ]

    def test_get_two_data_tags(self, client, django_settings, tag_in_data, another_tag_in_data):
        response = client.get(reverse(views.get_tags))
        assert response.json()["tags"] == [
            {
                "name": "Another Tag in Data",
                "parent": None,
                "aliases": ["AnotherTaginData"],
                "children": [],
                "isEnabledByDefault": True,
            },
            {"name": "NSFW", "parent": None, "aliases": [], "children": [], "isEnabledByDefault": True},
            {
                "name": "Tag in Data",
                "parent": None,
                "aliases": ["TaginData"],
                "children": [],
                "isEnabledByDefault": True,
            },
        ]

    def test_get_hierarchical_tags(self, client, django_settings, grandchild_tag):
        response = client.get(reverse(views.get_tags))
        assert response.json()["tags"] == [
            {"name": "NSFW", "parent": None, "aliases": [], "isEnabledByDefault": True, "children": []},
            {
                "name": "Tag in Data",
                "parent": None,
                "aliases": ["TaginData"],
                "isEnabledByDefault": True,
                "children": [
                    {
                        "name": "Child Tag",
                        "parent": "Tag in Data",
                        "aliases": ["ChildTag"],
                        "isEnabledByDefault": True,
                        "children": [
                            {
                                "name": "Grandchild Tag",
                                "parent": "Child Tag",
                                "aliases": ["GrandchildTag"],
                                "isEnabledByDefault": True,
                                "children": [],
                            }
                        ],
                    }
                ],
            },
        ]

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_tags))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestPostCardbacks:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, django_settings, all_sources):
        pass

    def test_get_multiple_rows_unfiltered(self, client, snapshot, all_cards):
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": BASE_SEARCH_SETTINGS}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.json()["cardbacks"] == [Cards.SIMPLE_CUBE.value.identifier, Cards.SIMPLE_LOTUS.value.identifier]

    def test_get_multiple_rows_filtered_only_source_1(self, client, snapshot, all_cards):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_1.value.pk, True],
            [Sources.EXAMPLE_DRIVE_2.value.pk, False],
        ]
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.json()["cardbacks"] == [Cards.SIMPLE_CUBE.value.identifier]

    def test_get_multiple_rows_filtered_only_source_2(self, client, snapshot, all_cards):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_1.value.pk, False],
            [Sources.EXAMPLE_DRIVE_2.value.pk, True],
        ]
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.json()["cardbacks"] == [Cards.SIMPLE_LOTUS.value.identifier]

    def test_get_multiple_rows_filtered_ordered_sources(self, client, snapshot, all_cards):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        search_settings["sourceSettings"]["sources"] = [
            [Sources.EXAMPLE_DRIVE_2.value.pk, True],
            [Sources.EXAMPLE_DRIVE_1.value.pk, True],
        ]
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.json()["cardbacks"] == [Cards.SIMPLE_LOTUS.value.identifier, Cards.SIMPLE_CUBE.value.identifier]

    def test_minimum_dpi_yielding_no_cardbacks(self, client, snapshot, all_cards):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        search_settings["filterSettings"]["minimumDPI"] = 1200
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert len(response.json()["cardbacks"]) == 0

    def test_maximum_dpi_yielding_no_cardbacks(self, client, snapshot, all_cards):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        search_settings["filterSettings"]["maximumDPI"] = 200
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert len(response.json()["cardbacks"]) == 0

    def test_maximum_size_yielding_no_cardbacks(self, client, snapshot, all_cards):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        search_settings["filterSettings"]["maximumDPI"] = 5
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert len(response.json()["cardbacks"]) == 0

    def test_get_one_row_filtered_one_language(self, client, snapshot, simple_cube, simple_lotus):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["languages"] = ["EN"]
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["cardbacks"]) == 1

    def test_get_multiple_rows_filtered_two_languages(self, client, snapshot, simple_cube, simple_lotus):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["languages"] = ["EN", "DE"]
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["cardbacks"]) == 2

    def test_get_one_row_filtered_includes_one_tag(
        self, client, snapshot, simple_cube, simple_lotus, another_tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["includesTags"] = [another_tag_in_data.name]
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["cardbacks"]) == 1

    def test_get_one_row_filtered_excludes_one_tag(
        self, client, snapshot, simple_cube, simple_lotus, another_tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["excludesTags"] = [another_tag_in_data.name]
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["cardbacks"]) == 1

    def test_get_multiple_rows_filtered_includes_one_tag(
        self, client, snapshot, simple_cube, simple_lotus, tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["includesTags"] = [tag_in_data.name]
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["cardbacks"]) == 2

    def test_get_one_row_filtered_includes_one_tag_and_excludes_another(
        self, client, snapshot, simple_cube, simple_lotus, tag_in_data, another_tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["includesTags"] = [tag_in_data.name]
        search_settings["filterSettings"]["excludesTags"] = [another_tag_in_data.name]
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["cardbacks"]) == 1

    def test_get_multiple_rows_filtered_includes_two_tags(
        self, client, snapshot, simple_cube, simple_lotus, tag_in_data, another_tag_in_data
    ):
        search_settings = deepcopy(BASE_SEARCH_SETTINGS)
        search_settings["filterSettings"]["includesTags"] = [tag_in_data.name, another_tag_in_data.name]
        search_settings["searchTypeSettings"]["filterCardbacks"] = True
        response = client.post(
            reverse(views.post_cardbacks), {"searchSettings": search_settings}, content_type="application/json"
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200
        assert len(response.json()["cardbacks"]) == 2

    @pytest.mark.parametrize(
        "json_body",
        [{}, ["test"], {"man": "man"}, {"searchSettings": "test2"}],
        ids=["empty json body", "array json body", "search settings not specified", "invalid search settings"],
    )
    def test_response_to_malformed_json_body(self, client, snapshot, json_body):
        response = client.post(reverse(views.post_cardbacks), json_body, content_type="application/json")
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    def test_get_request(self, client, django_settings, snapshot):
        response = client.get(reverse(views.post_cardbacks))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetImportSites:
    def test_get_multiple_sites(self, client, dummy_integration, snapshot):
        response = client.get(reverse(views.get_import_sites))
        snapshot_response(response, snapshot)

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_import_sites))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestPostImportSiteDecklist:
    @pytest.fixture(autouse=True)
    def autouse_dummy_integration(self, dummy_integration):
        pass

    def test_valid_url(self, client, django_settings, snapshot):
        response = client.post(
            reverse(views.post_import_site_decklist),
            {"url": f"https://{DummyImportSite.get_host_names()[0]}/whatever"},
            content_type="application/json",
        )
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
        assert set(json_body["cards"].keys()) == {"CARD", "CARDBACK", "TOKEN"}
        # the view returns a list of cards, but the order of the cards is deliberately random
        # keying the data by card name in this way should result in deterministic snapshotting
        assert {
            card_type: {row["name"]: row for row in sorted(cards, key=lambda x: x["name"])}
            for card_type, cards in json_body["cards"].items()
        } == snapshot

    def test_get_no_cards(self, client, django_settings, elasticsearch, all_sources, snapshot):
        response = client.get(reverse(views.get_sample_cards))
        assert response.status_code == 200
        assert response.json()["cards"] == {"CARD": [], "TOKEN": [], "CARDBACK": []}

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

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_sample_cards))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetContributions:
    def test_get_multiple_rows(self, client, django_settings, snapshot, all_sources, all_cards):
        response = client.get(reverse(views.get_contributions))
        snapshot_response(response, snapshot)

    def test_get_one_row(self, client, snapshot, django_settings, example_drive_1, island, island_classical):
        response = client.get(reverse(views.get_contributions))
        snapshot_response(response, snapshot)

    def test_get_source_with_no_cards(self, client, django_settings, snapshot, all_sources):
        response = client.get(reverse(views.get_contributions))
        snapshot_response(response, snapshot)

    def test_with_no_sources(self, client, django_settings, snapshot, db):
        response = client.get(reverse(views.get_contributions))
        snapshot_response(response, snapshot)

    def test_get_contribution_with_private_identifier(self, client, db):
        SourceFactory(identifier="secret", external_link=None)
        response = client.get(reverse(views.get_contributions))
        response_json = response.json()
        assert len(response_json["sources"]) == 1
        serialised_source = response_json["sources"][0]
        for value in serialised_source.values():
            assert "secret" not in str(value)

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_contributions))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetInfo:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, populated_database):
        pass

    # TODO: write tests
    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_info))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestGetSearchEngineHealth:
    def test_elasticsearch_healthy(self, client, django_settings, elasticsearch, snapshot):
        response = client.get(reverse(views.get_search_engine_health))
        snapshot_response(response, snapshot)
        assert response.json()["online"] is True

    # TODO: consider how to test elasticsearch being unhealthy
    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_search_engine_health))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestNewCardsFirstPages:
    @pytest.fixture(autouse=True)
    def autouse_django_settings(self, django_settings):
        pass

    @pytest.fixture(autouse=True)
    def six_card_page(self, monkeypatch) -> None:
        # just to make this more testable with few `Card` fixtures
        monkeypatch.setattr("cardpicker.search.search_functions.NEW_CARDS_PAGE_SIZE", 6)

    @freezegun.freeze_time(dt.datetime(2023, 1, 2))
    def test_basic_case(self, client, all_sources, all_cards, snapshot):
        response = client.get(reverse(views.get_new_cards_first_pages))
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    @freezegun.freeze_time(dt.datetime(2024, 1, 2))
    def test_no_data_in_date_range(self, client, all_sources, all_cards, snapshot):
        response = client.get(reverse(views.get_new_cards_first_pages))
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    def test_no_cards(self, client, all_sources, snapshot):
        response = client.get(reverse(views.get_new_cards_first_pages))
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    def test_no_sources(self, client, snapshot):
        response = client.get(reverse(views.get_new_cards_first_pages))
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_new_cards_first_pages))
        snapshot_response(response, snapshot)
        assert response.status_code == 400


class TestNewCardsPage:
    @pytest.fixture(autouse=True)
    def autouse_populated_database(self, django_settings, all_sources, all_cards):
        pass

    @pytest.fixture(autouse=True)
    def six_card_page(self, monkeypatch) -> None:
        # just to make this more testable with few `Card` fixtures
        monkeypatch.setattr("cardpicker.search.search_functions.NEW_CARDS_PAGE_SIZE", 6)

    @freezegun.freeze_time(dt.datetime(2023, 1, 2))
    def test_get_full_first_page(self, client, snapshot):
        response = client.get(
            reverse(views.get_new_cards_page), {"source": Sources.EXAMPLE_DRIVE_1.value.key, "page": 1}
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    @freezegun.freeze_time(dt.datetime(2023, 1, 2))
    def test_get_partial_first_page(self, client, snapshot):
        response = client.get(
            reverse(views.get_new_cards_page), {"source": Sources.EXAMPLE_DRIVE_2.value.key, "page": 1}
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    @freezegun.freeze_time(dt.datetime(2023, 1, 2))
    def test_get_full_second_page(self, client, snapshot):
        response = client.get(
            reverse(views.get_new_cards_page), {"source": Sources.EXAMPLE_DRIVE_1.value.key, "page": 2}
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    @freezegun.freeze_time(dt.datetime(2024, 1, 2))
    def test_no_data_in_date_range(self, client, snapshot):
        response = client.get(
            reverse(views.get_new_cards_page), {"source": Sources.EXAMPLE_DRIVE_1.value.key, "page": 1}
        )
        snapshot_response(response, snapshot)
        assert response.status_code == 200

    def test_post_request(self, client, django_settings, snapshot):
        response = client.post(reverse(views.get_new_cards_page))
        snapshot_response(response, snapshot)
        assert response.status_code == 400

    @freezegun.freeze_time(dt.datetime(2023, 1, 2))
    @pytest.mark.parametrize(
        "params",
        [
            {},
            {"source": "garbage", "page": 1},
            {"source": Sources.EXAMPLE_DRIVE_1.value.key, "page": 0},
            {"source": Sources.EXAMPLE_DRIVE_1.value.key, "page": -1},
            {"source": Sources.EXAMPLE_DRIVE_1.value.key, "page": "heck"},
            {"garbage": Sources.EXAMPLE_DRIVE_1.value.key, "page": 1},
            {"source": Sources.EXAMPLE_DRIVE_1.value.key, "garbage": 1},
            {"source": Sources.EXAMPLE_DRIVE_1.value.key, "page": 10},
        ],
        ids=[
            "no params",
            "invalid source",
            "zero page",
            "negative page",
            "non-number page",
            "no source field",
            "no page field",
            "page out of range for source",
        ],
    )
    def test_response_to_malformed_json_body(self, client, django_settings, snapshot, params):
        response = client.get(reverse(views.get_new_cards_page), params)
        snapshot_response(response, snapshot)
        assert response.status_code == 400
