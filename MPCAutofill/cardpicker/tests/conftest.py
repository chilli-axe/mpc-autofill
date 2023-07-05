import pytest
from pytest_elasticsearch import factories

from django.core.management import call_command

from cardpicker.models import Card, CardTypes, Source
from cardpicker.tests.constants import Cards, Sources
from cardpicker.tests.factories import CardFactory, SourceFactory


@pytest.fixture()
def django_settings(db, settings):
    settings.DEBUG = True
    settings.DEFAULT_CARDBACK_FOLDER_PATH = "MPC Autofill Sample 1 / Cardbacks"
    settings.DEFAULT_CARDBACK_IMAGE_NAME = Cards.SIMPLE_CUBE.value.name


@pytest.fixture(scope="session", autouse=True)
def elasticsearch():
    """
    This fixture expects elasticsearch to be running on your machine.
    """

    return factories.elasticsearch("elasticsearch_nooproc")


# region Source fixtures


@pytest.fixture()
def example_drive_1() -> Source:
    return SourceFactory(
        key=Sources.EXAMPLE_DRIVE_1.value.key,
        name=Sources.EXAMPLE_DRIVE_1.value.name,
        identifier=Sources.EXAMPLE_DRIVE_1.value.identifier,
        source_type=Sources.EXAMPLE_DRIVE_1.value.source_type,
        external_link=f"https://drive.google.com/open?id={Sources.EXAMPLE_DRIVE_1.value.identifier}",
    )


@pytest.fixture()
def example_drive_2() -> Source:
    return SourceFactory(
        key=Sources.EXAMPLE_DRIVE_2.value.key,
        name=Sources.EXAMPLE_DRIVE_2.value.name,
        identifier=Sources.EXAMPLE_DRIVE_2.value.identifier,
        source_type=Sources.EXAMPLE_DRIVE_2.value.source_type,
    )


@pytest.fixture()
def all_sources(example_drive_1, example_drive_2):
    pass


# endregion

# region Card fixtures


@pytest.fixture()
def brainstorm(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5",
        name="Brainstorm",
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def island(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1IDtqSjJ4Yo45AnNA4SplOiN7ewibifMa",
        name="Island",
        source=example_drive_1,
        priority=7,
    )


@pytest.fixture()
def island_classical(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1HsvTYs1jFGe1c8U1PnNZ9aB8jkAW7KU0",
        name="Island (William Bradford)",
        source=example_drive_1,
        priority=6,
    )


@pytest.fixture()
def mountain(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1-dcs0FEE05MTGiYbKqs9HnRdhXkgtIJG",
        name="Mountain",
        source=example_drive_1,
        priority=7,
    )


@pytest.fixture()
def simple_cube(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARDBACK,
        identifier="1JtXL6Ca9nQkvhwZZRR9ZuKA9_DzsFf1V",
        name="Simple Cube",
        source=example_drive_1,
        priority=17,
    )


@pytest.fixture()
def simple_lotus(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARDBACK,
        identifier="1oigI6wz0zA--pNMuExKTs40kBNH6VRP_",
        name="Simple Lotus",
        source=example_drive_1,
        priority=7,
    )


@pytest.fixture()
def huntmaster_of_the_fells(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1991MWCur9NdAFi-tQQD5YbQj2oqV_WRy",
        name="Huntmaster of the Fells",
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def ravager_of_the_fells(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1lv8WC1Xf1qxA7VHSc8jOtT5up6FwaBPH",
        name="Ravager of the Fells",
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def past_in_flames_1(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1UPdh7J7hScg4ZnxSPJ-EeBYHLp2s3Oz1",
        name="Past in Flames",
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def past_in_flames_2(example_drive_2) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1dxSLHtw-VwwE09pZCA8OA6LbuWRZPEoU",
        name="Past in Flames",
        source=example_drive_2,
        priority=2,
    )


@pytest.fixture()
def delver_of_secrets(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="17fopRCNRge72U8Hac8pApHZtEalx5kHy",
        name="Delver of Secrets",
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def insectile_aberration(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.CARD,
        identifier="1mO73GTYlieP0kiZEkF58pJSrZTmC9lNh",
        name="Insectile Aberration",
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def goblin(example_drive_1) -> Card:
    return CardFactory(
        card_type=CardTypes.TOKEN,
        identifier="1V5E0avDmNyEUuFfYwx3nA05aj-1HY0rA",
        name="Goblin",
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def all_cards(
    brainstorm,
    island,
    island_classical,
    mountain,
    simple_cube,
    simple_lotus,
    huntmaster_of_the_fells,
    ravager_of_the_fells,
    past_in_flames_1,
    past_in_flames_2,
    delver_of_secrets,
    insectile_aberration,
    goblin,
):
    pass


# endregion


@pytest.fixture(scope="function")  # must be function scoped because the `db` fixture is fn-scoped
def populated_database(django_settings, elasticsearch, all_sources, all_cards):
    call_command("search_index", "--rebuild", "-f")
