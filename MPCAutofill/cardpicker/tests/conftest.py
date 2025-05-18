import datetime as dt
from typing import Type

import pytest
from pytest_elasticsearch import factories
from testcontainers.elasticsearch import ElasticSearchContainer
from testcontainers.postgres import PostgresContainer

from django.conf import settings as conf_settings
from django.core.management import call_command

from cardpicker.integrations.game.base import GameIntegration
from cardpicker.models import Card, CardTypes, DFCPair, Source, Tag
from cardpicker.tests.constants import Cards, DummyIntegration, Sources
from cardpicker.tests.factories import (
    CardFactory,
    DFCPairFactory,
    SourceFactory,
    TagFactory,
)

POSTGRES_PORT = 47000
ELASTICSEARCH_PORT = 9300  # this is the default expected by `elasticsearch_nooproc`


@pytest.fixture(scope="session")
def postgres_container():
    postgres = PostgresContainer("postgres:16.0-alpine").with_bind_ports(5432, POSTGRES_PORT)
    postgres.start()
    yield postgres
    postgres.stop()


@pytest.fixture(scope="session")
def elasticsearch_container():
    elasticsearch = ElasticSearchContainer("elasticsearch:7.17.23", mem_limit="1G").with_bind_ports(
        9200, ELASTICSEARCH_PORT
    )
    elasticsearch.start()
    yield elasticsearch
    elasticsearch.stop()


@pytest.fixture(scope="session")
def django_db_modify_db_settings(postgres_container):
    # customise settings to point to testcontainers db
    conf_settings.DATABASES["default"]["HOST"] = postgres_container.get_container_host_ip()
    conf_settings.DATABASES["default"]["PORT"] = POSTGRES_PORT
    conf_settings.DATABASES["default"]["NAME"] = postgres_container.dbname
    conf_settings.DATABASES["default"]["USER"] = postgres_container.username
    conf_settings.DATABASES["default"]["PASSWORD"] = postgres_container.password


@pytest.fixture()
def django_settings(db, settings):
    settings.DEBUG = True
    settings.DEFAULT_CARDBACK_FOLDER_PATH = "MPC Autofill Sample 1 / Cardbacks"
    settings.DEFAULT_CARDBACK_IMAGE_NAME = Cards.SIMPLE_CUBE.value.name
    settings.TIME_ZONE = "UTC"


@pytest.fixture()
def integration_setter(settings, monkeypatch):
    # this uses a neat lil trick i picked up at work for creating "parametrised fixtures"
    def _setter(integration: Type[GameIntegration]) -> Type[GameIntegration]:
        settings.GAME = integration.__class__.__name__
        monkeypatch.setattr("cardpicker.views.get_configured_game_integration", lambda: integration)
        monkeypatch.setattr("cardpicker.dfc_pairs.get_configured_game_integration", lambda: integration)
        return integration

    return _setter


@pytest.fixture()
def dummy_integration(integration_setter) -> Type[GameIntegration]:
    return integration_setter(DummyIntegration)


@pytest.fixture(scope="session", autouse=True)
def elasticsearch(elasticsearch_container):
    conf_settings.ELASTICSEARCH_DSL["default"][
        "hosts"
    ] = f"{elasticsearch_container.get_container_host_ip()}:{ELASTICSEARCH_PORT}"
    conf_settings.ELASTICSEARCH_PORT = ELASTICSEARCH_PORT
    return factories.elasticsearch("elasticsearch_nooproc")


# region Source fixtures


@pytest.fixture()
def example_drive_1(db) -> Source:
    return SourceFactory(
        pk=Sources.EXAMPLE_DRIVE_1.value.pk,
        key=Sources.EXAMPLE_DRIVE_1.value.key,
        name=Sources.EXAMPLE_DRIVE_1.value.name,
        identifier=Sources.EXAMPLE_DRIVE_1.value.identifier,
        source_type=Sources.EXAMPLE_DRIVE_1.value.source_type,
        external_link=f"https://drive.google.com/open?id={Sources.EXAMPLE_DRIVE_1.value.identifier}",
    )


@pytest.fixture()
def example_drive_2(db) -> Source:
    return SourceFactory(
        pk=Sources.EXAMPLE_DRIVE_2.value.pk,
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
        dpi=Cards.BRAINSTORM.value.dpi,
        source=example_drive_1,
        priority=2,
        size=Cards.BRAINSTORM.value.size,
        date_created=dt.datetime(2023, 1, 1),
    )


@pytest.fixture()
def island(example_drive_1) -> Card:
    return CardFactory(
        pk=Cards.ISLAND.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.ISLAND.value.identifier,
        name=Cards.ISLAND.value.name,
        dpi=Cards.ISLAND.value.dpi,
        source=example_drive_1,
        priority=7,
        size=Cards.ISLAND.value.size,
        date_created=dt.datetime(2023, 1, 1),
    )


@pytest.fixture()
def island_classical(example_drive_1) -> Card:
    return CardFactory(
        pk=Cards.ISLAND_CLASSICAL.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.ISLAND_CLASSICAL.value.identifier,
        name=Cards.ISLAND_CLASSICAL.value.name,
        dpi=Cards.ISLAND_CLASSICAL.value.dpi,
        source=example_drive_1,
        priority=6,
        size=Cards.ISLAND_CLASSICAL.value.size,
        date_created=dt.datetime(2023, 1, 1),
        language="FR",
    )


@pytest.fixture()
def mountain(example_drive_1) -> Card:
    return CardFactory(
        pk=Cards.MOUNTAIN.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.MOUNTAIN.value.identifier,
        name=Cards.MOUNTAIN.value.name,
        dpi=Cards.MOUNTAIN.value.dpi,
        source=example_drive_1,
        priority=7,
        size=Cards.MOUNTAIN.value.size,
        date_created=dt.datetime(2023, 1, 1),
    )


@pytest.fixture()
def simple_cube(example_drive_1, tag_in_data, another_tag_in_data) -> Card:
    return CardFactory(
        pk=Cards.SIMPLE_CUBE.value.pk,
        card_type=CardTypes.CARDBACK,
        identifier=Cards.SIMPLE_CUBE.value.identifier,
        name=Cards.SIMPLE_CUBE.value.name,
        dpi=Cards.SIMPLE_CUBE.value.dpi,
        source=example_drive_1,
        priority=17,
        size=Cards.SIMPLE_CUBE.value.size,
        date_created=dt.datetime(2023, 1, 1),
        tags=[tag_in_data.name, another_tag_in_data.name],
        language="DE",
    )


@pytest.fixture()
def simple_lotus(example_drive_2, tag_in_data) -> Card:
    return CardFactory(
        pk=Cards.SIMPLE_LOTUS.value.pk,
        card_type=CardTypes.CARDBACK,
        identifier=Cards.SIMPLE_LOTUS.value.identifier,
        name=Cards.SIMPLE_LOTUS.value.name,
        dpi=Cards.SIMPLE_LOTUS.value.dpi,
        source=example_drive_2,
        priority=7,
        size=Cards.SIMPLE_LOTUS.value.size,
        date_created=dt.datetime(2023, 1, 1),
        tags=[tag_in_data.name],
        language="EN",
    )


@pytest.fixture()
def huntmaster_of_the_fells(example_drive_1) -> Card:
    return CardFactory(
        pk=Cards.HUNTMASTER_OF_THE_FELLS.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.HUNTMASTER_OF_THE_FELLS.value.identifier,
        name=Cards.HUNTMASTER_OF_THE_FELLS.value.name,
        dpi=Cards.HUNTMASTER_OF_THE_FELLS.value.dpi,
        source=example_drive_1,
        priority=2,
        size=Cards.HUNTMASTER_OF_THE_FELLS.value.size,
        date_created=dt.datetime(2023, 1, 1),
    )


@pytest.fixture()
def ravager_of_the_fells(example_drive_1) -> Card:
    return CardFactory(
        pk=Cards.RAVAGER_OF_THE_FELLS.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.RAVAGER_OF_THE_FELLS.value.identifier,
        name=Cards.RAVAGER_OF_THE_FELLS.value.name,
        dpi=Cards.RAVAGER_OF_THE_FELLS.value.dpi,
        source=example_drive_1,
        priority=2,
        size=Cards.RAVAGER_OF_THE_FELLS.value.size,
        date_created=dt.datetime(2023, 1, 1),
    )


@pytest.fixture()
def past_in_flames_1(example_drive_1, tag_in_data) -> Card:
    return CardFactory(
        pk=Cards.PAST_IN_FLAMES_1.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.PAST_IN_FLAMES_1.value.identifier,
        name=Cards.PAST_IN_FLAMES_1.value.name,
        dpi=Cards.PAST_IN_FLAMES_1.value.dpi,
        source=example_drive_1,
        priority=2,
        size=Cards.PAST_IN_FLAMES_1.value.size,
        date_created=dt.datetime(2023, 1, 1),
        tags=[tag_in_data.name],
        language="EN",
    )


@pytest.fixture()
def past_in_flames_2(example_drive_2, tag_in_data, another_tag_in_data) -> Card:
    return CardFactory(
        pk=Cards.PAST_IN_FLAMES_2.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.PAST_IN_FLAMES_2.value.identifier,
        name=Cards.PAST_IN_FLAMES_2.value.name,
        dpi=Cards.PAST_IN_FLAMES_2.value.dpi,
        source=example_drive_2,
        priority=2,
        size=Cards.PAST_IN_FLAMES_2.value.size,
        date_created=dt.datetime(2023, 1, 1),
        tags=[tag_in_data.name, another_tag_in_data.name],
        language="DE",
    )


@pytest.fixture()
def delver_of_secrets(example_drive_1) -> Card:
    return CardFactory(
        pk=Cards.DELVER_OF_SECRETS.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.DELVER_OF_SECRETS.value.identifier,
        name=Cards.DELVER_OF_SECRETS.value.name,
        dpi=Cards.DELVER_OF_SECRETS.value.dpi,
        source=example_drive_1,
        priority=2,
        size=Cards.DELVER_OF_SECRETS.value.size,
        date_created=dt.datetime(2023, 1, 1),
    )


@pytest.fixture()
def insectile_aberration(example_drive_1) -> Card:
    return CardFactory(
        pk=Cards.INSECTILE_ABERRATION.value.pk,
        card_type=CardTypes.CARD,
        identifier=Cards.INSECTILE_ABERRATION.value.identifier,
        name=Cards.INSECTILE_ABERRATION.value.name,
        dpi=Cards.INSECTILE_ABERRATION.value.dpi,
        source=example_drive_1,
        priority=2,
        size=Cards.INSECTILE_ABERRATION.value.size,
        date_created=dt.datetime(2023, 1, 1),
    )


@pytest.fixture()
def goblin(example_drive_1) -> Card:
    return CardFactory(
        pk=Cards.GOBLIN.value.pk,
        card_type=CardTypes.TOKEN,
        identifier=Cards.GOBLIN.value.identifier,
        name=Cards.GOBLIN.value.name,
        dpi=Cards.GOBLIN.value.dpi,
        source=example_drive_1,
        priority=2,
        size=Cards.GOBLIN.value.size,
        date_created=dt.datetime(2023, 1, 1),
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
) -> None:
    pass


# endregion

# region DFCPair fixtures


@pytest.fixture()
def dfc_pairs(db) -> list[DFCPair]:
    return [
        DFCPairFactory(
            pk=0, front=Cards.HUNTMASTER_OF_THE_FELLS.value.name, back=Cards.RAVAGER_OF_THE_FELLS.value.name
        ),
        DFCPairFactory(pk=1, front=Cards.DELVER_OF_SECRETS.value.name, back=Cards.INSECTILE_ABERRATION.value.name),
    ]


# endregion


# region tag fixtures


@pytest.fixture()
def tag_in_data(db) -> Tag:
    return TagFactory(name="Tag in Data")


@pytest.fixture()
def extended_tag(db) -> Tag:
    return TagFactory(name="Extended")


@pytest.fixture()
def full_art_tag(db) -> Tag:
    return TagFactory(name="Full Art")


@pytest.fixture()
def child_tag(db, tag_in_data) -> Tag:
    return TagFactory(name="Child Tag", parent=tag_in_data)


@pytest.fixture()
def grandchild_tag(db, child_tag) -> Tag:
    return TagFactory(name="Grandchild Tag", parent=child_tag)


@pytest.fixture()
def another_tag_in_data(db) -> Tag:
    return TagFactory(name="Another Tag in Data")


# endregion


@pytest.fixture(scope="function")  # must be function scoped because the `db` fixture is fn-scoped
def populated_database(django_settings, elasticsearch, all_sources, all_cards):
    call_command("search_index", "--rebuild", "-f")
