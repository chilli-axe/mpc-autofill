import os
import re
import shutil
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

FILE_PATH = os.path.abspath(os.path.dirname(__file__))
DOWNLOAD_FOLDER = os.path.join(FILE_PATH, "downloads")


@pytest.fixture()
def chrome_driver() -> Chrome:
    options = Options()
    options.add_argument("--headless")
    options.add_experimental_option("prefs", {"download.default_directory": DOWNLOAD_FOLDER})
    driver = Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.set_window_size(1440, 900)
    driver.implicitly_wait(0)
    os.mkdir(DOWNLOAD_FOLDER)
    yield driver
    driver.quit()
    shutil.rmtree(DOWNLOAD_FOLDER, ignore_errors=True)


class TestFrontend:
    @pytest.fixture(autouse=True)
    def enable_db_access_and_django_debug(self, db, settings):
        # only autouse within the scope of this class
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

    def test_basic_search_and_xml_generation(self, elasticsearch, chrome_driver, live_server):
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()

        load_modal = chrome_driver.find_element(By.ID, value="loadModal")
        WebDriverWait(chrome_driver, 1).until(visibility_of(load_modal))
        WebDriverWait(chrome_driver, 1).until(invisibility_of_element(load_modal))
        time.sleep(2)

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

        chrome_driver.find_element(By.ID, value="btn_generate_xml").click()
        time.sleep(1)
        with open(os.path.join(DOWNLOAD_FOLDER, "cards.xml"), "r") as f:
            assert re.sub(r"[\n\t\s]*", "", str(f.read())) == re.sub(
                r"[\n\t\s]*",
                "",
                (
                    """
                <order>
                    <details>
                        <quantity>7</quantity>
                        <bracket>18</bracket>
                        <stock>(S30) Standard Smooth</stock>
                        <foil>false</foil>
                    </details>
                    <fronts>
                        <card>
                            <id>1MapGHeusRE1RD-VKPzDSeABudGXF_4Uh</id>
                            <slots>1,2,0,3</slots>
                            <name>Brainstorm.png</name>
                            <query>brainstorm</query>
                        </card>
                        <card>
                            <id>19aEsBrSKeKcrBBrcCHVSU80J_ViEVhib</id>
                            <slots>4,5,6</slots>
                            <name>Island.png</name>
                            <query>island</query>
                        </card>
                    </fronts>
                    <cardback>11CpSsZ4KuDTvKco5HAa8qcfLgWxV21CP</cardback>
                </order>
                """
                ),
            )

    def test_toggle_faces(self, elasticsearch, chrome_driver, live_server):
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()

        load_modal = chrome_driver.find_element(By.ID, value="loadModal")
        WebDriverWait(chrome_driver, 1).until(visibility_of(load_modal))
        WebDriverWait(chrome_driver, 1).until(invisibility_of_element(load_modal))
        time.sleep(2)

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
