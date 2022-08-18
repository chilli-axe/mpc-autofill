import time

import pytest
from cardpicker.sources.source_types import SourceTypeChoices
from cardpicker.tests.factories import SourceFactory
from django.core.management import call_command
from pytest_elasticsearch import factories
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.expected_conditions import (
    invisibility_of_element,
    visibility_of,
)
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


@pytest.fixture()
def chrome_driver() -> Chrome:
    options = Options()
    options.add_argument("--headless")
    driver = Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.set_window_size(1440, 900)
    driver.implicitly_wait(0)
    yield driver
    driver.quit()


class TestFrontend:
    @pytest.fixture(autouse=True)
    def enable_db_access_and_django_debug(self, db, settings):
        # only within the scope of this class
        settings.DEBUG = True

    @pytest.fixture()
    def elasticsearch(self):
        return factories.elasticsearch("elasticsearch_nooproc")

    @pytest.fixture(autouse=True)
    def stand_up_database(self, elasticsearch) -> None:
        SourceFactory(
            key="example_cards",
            name="Example Cards",
            identifier="1cdKnZRbyXJEtsNwzE2dJA4H5EVEzsI_Y",
            source_type=SourceTypeChoices.GOOGLE_DRIVE,
        )
        call_command("update_database")

    def test_basic_search(self, elasticsearch, chrome_driver, live_server):
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()

        load_modal = chrome_driver.find_element(By.ID, value="loadModal")
        WebDriverWait(chrome_driver, 1).until(visibility_of(load_modal))
        WebDriverWait(chrome_driver, 1).until(invisibility_of_element(load_modal))
        time.sleep(1)

        assert chrome_driver.find_element(By.ID, value="order_qty").text == "7"
        assert chrome_driver.find_element(By.ID, value="order_bracket").text == "18"

        assert chrome_driver.find_element(By.ID, value="slot0-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot0-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot0-front-mpccard-name").text == "Brainstorm"
        assert chrome_driver.find_element(By.ID, value="slot0-front-mpccard-counter").text == "1/1"
        assert "Example Cards" in chrome_driver.find_element(By.ID, value="slot0-front-mpccard-source").text

        assert chrome_driver.find_element(By.ID, value="slot1-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot1-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot1-front-mpccard-name").text == "Brainstorm"
        assert chrome_driver.find_element(By.ID, value="slot1-front-mpccard-counter").text == "1/1"
        assert "Example Cards" in chrome_driver.find_element(By.ID, value="slot1-front-mpccard-source").text

        assert chrome_driver.find_element(By.ID, value="slot2-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot2-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot2-front-mpccard-name").text == "Brainstorm"
        assert chrome_driver.find_element(By.ID, value="slot2-front-mpccard-counter").text == "1/1"
        assert "Example Cards" in chrome_driver.find_element(By.ID, value="slot2-front-mpccard-source").text

        assert chrome_driver.find_element(By.ID, value="slot3-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot3-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot3-front-mpccard-name").text == "Brainstorm"
        assert chrome_driver.find_element(By.ID, value="slot3-front-mpccard-counter").text == "1/1"
        assert "Example Cards" in chrome_driver.find_element(By.ID, value="slot3-front-mpccard-source").text

        assert chrome_driver.find_element(By.ID, value="slot4-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot4-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot4-front-mpccard-name").text == "Island"
        assert chrome_driver.find_element(By.ID, value="slot4-front-mpccard-counter").text == "1/1"
        assert "Example Cards" in chrome_driver.find_element(By.ID, value="slot4-front-mpccard-source").text

        assert chrome_driver.find_element(By.ID, value="slot5-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot5-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot5-front-mpccard-name").text == "Island"
        assert chrome_driver.find_element(By.ID, value="slot5-front-mpccard-counter").text == "1/1"
        assert "Example Cards" in chrome_driver.find_element(By.ID, value="slot5-front-mpccard-source").text

        assert chrome_driver.find_element(By.ID, value="slot6-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot6-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot6-front-mpccard-name").text == "Island"
        assert chrome_driver.find_element(By.ID, value="slot6-front-mpccard-counter").text == "1/1"
        assert "Example Cards" in chrome_driver.find_element(By.ID, value="slot6-front-mpccard-source").text

    def test_toggle_faces(self, elasticsearch, chrome_driver, live_server):
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()

        load_modal = chrome_driver.find_element(By.ID, value="loadModal")
        WebDriverWait(chrome_driver, 1).until(visibility_of(load_modal))
        WebDriverWait(chrome_driver, 1).until(invisibility_of_element(load_modal))
        time.sleep(1)

        assert chrome_driver.find_element(By.ID, value="slot0-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot0-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot1-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot1-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot2-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot2-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot3-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot3-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot4-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot4-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot5-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot5-back").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot6-front").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot6-back").is_displayed() is False

        chrome_driver.find_element(By.ID, value="switchFacesBtn").click()

        assert chrome_driver.find_element(By.ID, value="slot0-front").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot0-back").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot1-front").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot1-back").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot2-front").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot2-back").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot3-front").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot3-back").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot4-front").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot4-back").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot5-front").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot5-back").is_displayed() is True
        assert chrome_driver.find_element(By.ID, value="slot6-front").is_displayed() is False
        assert chrome_driver.find_element(By.ID, value="slot6-back").is_displayed() is True
