import pytest
from pytest_elasticsearch import factories

from django.core.management import call_command

from cardpicker.models import Card, CardTypes, Source
from cardpicker.tests.constants import Cards, Sources
from cardpicker.tests.factories import CardFactory, DFCPairFactory, SourceFactory
from cardpicker.utils.sanitisation import to_searchable


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
def example_drive_1(db) -> Source:
    return SourceFactory(
        pk=0,
        key=Sources.EXAMPLE_DRIVE_1.value.key,
        name=Sources.EXAMPLE_DRIVE_1.value.name,
        identifier=Sources.EXAMPLE_DRIVE_1.value.identifier,
        source_type=Sources.EXAMPLE_DRIVE_1.value.source_type,
        external_link=f"https://drive.google.com/open?id={Sources.EXAMPLE_DRIVE_1.value.identifier}",
    )


@pytest.fixture()
def example_drive_2(db) -> Source:
    return SourceFactory(
        pk=1,
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
        pk=0,
        card_type=CardTypes.CARD,
        identifier=Cards.BRAINSTORM.value.identifier,
        name=Cards.BRAINSTORM.value.name,
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def island(example_drive_1) -> Card:
    return CardFactory(
        pk=1,
        card_type=CardTypes.CARD,
        identifier=Cards.ISLAND.value.identifier,
        name=Cards.ISLAND.value.name,
        source=example_drive_1,
        priority=7,
    )


@pytest.fixture()
def island_classical(example_drive_1) -> Card:
    return CardFactory(
        pk=2,
        card_type=CardTypes.CARD,
        identifier=Cards.ISLAND_CLASSICAL.value.identifier,
        name=Cards.ISLAND_CLASSICAL.value.name,
        source=example_drive_1,
        priority=6,
    )


@pytest.fixture()
def mountain(example_drive_1) -> Card:
    return CardFactory(
        pk=3,
        card_type=CardTypes.CARD,
        identifier=Cards.MOUNTAIN.value.identifier,
        name=Cards.MOUNTAIN.value.name,
        source=example_drive_1,
        priority=7,
    )


@pytest.fixture()
def simple_cube(example_drive_1) -> Card:
    return CardFactory(
        pk=4,
        card_type=CardTypes.CARDBACK,
        identifier=Cards.SIMPLE_CUBE.value.identifier,
        name=Cards.SIMPLE_CUBE.value.name,
        source=example_drive_1,
        priority=17,
    )


@pytest.fixture()
def simple_lotus(example_drive_1) -> Card:
    return CardFactory(
        pk=5,
        card_type=CardTypes.CARDBACK,
        identifier=Cards.SIMPLE_LOTUS.value.identifier,
        name=Cards.SIMPLE_LOTUS.value.name,
        source=example_drive_1,
        priority=7,
    )


@pytest.fixture()
def huntmaster_of_the_fells(example_drive_1) -> Card:
    return CardFactory(
        pk=6,
        card_type=CardTypes.CARD,
        identifier=Cards.HUNTMASTER_OF_THE_FELLS.value.identifier,
        name=Cards.HUNTMASTER_OF_THE_FELLS.value.name,
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def ravager_of_the_fells(example_drive_1) -> Card:
    return CardFactory(
        pk=7,
        card_type=CardTypes.CARD,
        identifier=Cards.RAVAGER_OF_THE_FELLS.value.identifier,
        name=Cards.RAVAGER_OF_THE_FELLS.value.name,
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def past_in_flames_1(example_drive_1) -> Card:
    return CardFactory(
        pk=8,
        card_type=CardTypes.CARD,
        identifier=Cards.PAST_IN_FLAMES_1.value.identifier,
        name=Cards.PAST_IN_FLAMES_1.value.name,
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def past_in_flames_2(example_drive_2) -> Card:
    return CardFactory(
        pk=9,
        card_type=CardTypes.CARD,
        identifier=Cards.PAST_IN_FLAMES_2.value.identifier,
        name=Cards.PAST_IN_FLAMES_2.value.name,
        source=example_drive_2,
        priority=2,
    )


@pytest.fixture()
def delver_of_secrets(example_drive_1) -> Card:
    return CardFactory(
        pk=10,
        card_type=CardTypes.CARD,
        identifier=Cards.DELVER_OF_SECRETS.value.identifier,
        name=Cards.DELVER_OF_SECRETS.value.name,
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def insectile_aberration(example_drive_1) -> Card:
    return CardFactory(
        pk=11,
        card_type=CardTypes.CARD,
        identifier=Cards.INSECTILE_ABERRATION.value.identifier,
        name=Cards.INSECTILE_ABERRATION.value.name,
        source=example_drive_1,
        priority=2,
    )


@pytest.fixture()
def goblin(example_drive_1) -> Card:
    return CardFactory(
        pk=12,
        card_type=CardTypes.TOKEN,
        identifier=Cards.GOBLIN.value.identifier,
        name=Cards.GOBLIN.value.name,
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

# region DFCPair fixtures
@pytest.fixture()
def dfc_pairs(db):
    DFCPairFactory(
        pk=0,
        front=Cards.HUNTMASTER_OF_THE_FELLS.value.name,
        front_searchable=to_searchable(Cards.HUNTMASTER_OF_THE_FELLS.value.name),
        back=Cards.RAVAGER_OF_THE_FELLS.value.name,
        back_searchable=to_searchable(Cards.RAVAGER_OF_THE_FELLS.value.name),
    )
    DFCPairFactory(
        pk=1,
        front=Cards.DELVER_OF_SECRETS.value.name,
        front_searchable=to_searchable(Cards.DELVER_OF_SECRETS.value.name),
        back=Cards.INSECTILE_ABERRATION.value.name,
        back_searchable=to_searchable(Cards.INSECTILE_ABERRATION.value.name),
    )


# endregion


@pytest.fixture(scope="function")  # must be function scoped because the `db` fixture is fn-scoped
def populated_database(django_settings, elasticsearch, all_sources, all_cards):
    call_command("search_index", "--rebuild", "-f")
