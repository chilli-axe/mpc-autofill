import pytest
from pytest_elasticsearch import factories

from cardpicker.tests.constants import TestCards, TestSources
from cardpicker.tests.factories import SourceFactory


@pytest.fixture()
def django_settings(db, settings):
    settings.DEBUG = True
    settings.DEFAULT_CARDBACK_IMAGE_NAME = TestCards.SIMPLE_CUBE.value.name


@pytest.fixture(scope="session", autouse=True)
def elasticsearch():
    """
    This fixture expects elasticsearch to be running on your machine.
    """

    return factories.elasticsearch("elasticsearch_nooproc")


@pytest.fixture()
def stand_up_database(elasticsearch) -> None:
    SourceFactory(
        key=TestSources.EXAMPLE_DRIVE_1.value.key,
        name=TestSources.EXAMPLE_DRIVE_1.value.name,
        identifier=TestSources.EXAMPLE_DRIVE_1.value.identifier,
        source_type=TestSources.EXAMPLE_DRIVE_1.value.source_type,
    )
