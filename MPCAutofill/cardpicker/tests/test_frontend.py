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
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.expected_conditions import (
    invisibility_of_element,
    visibility_of,
)
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

FILE_PATH = os.path.abspath(os.path.dirname(__file__))
DOWNLOAD_FOLDER = os.path.join(FILE_PATH, "downloads")


class TestFrontend:
    # region fixtures

    @pytest.fixture()
    def chrome_driver(self) -> Chrome:
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

    @pytest.fixture()
    def valid_xml(self):
        xml_contents = """
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
        valid_xml_path = os.path.join(DOWNLOAD_FOLDER, "valid_xml.xml")
        with open(valid_xml_path, "w") as f:
            f.write(xml_contents)
        yield valid_xml_path
        os.remove(os.path.join(valid_xml_path))

    # endregion

    # region helpers
    @staticmethod
    def wait_for_search_results_modal(driver):
        load_modal = driver.find_element(By.ID, value="loadModal")
        WebDriverWait(driver, 1).until(visibility_of(load_modal))
        WebDriverWait(driver, 1).until(invisibility_of_element(load_modal))  # slot0-front
        time.sleep(2)

    @staticmethod
    def generate_and_download_xml(driver):
        driver.find_element(By.ID, value="btn_generate_xml").click()
        time.sleep(1)

    @staticmethod
    def assert_order_qty(driver, qty: int):
        assert driver.find_element(By.ID, value="order_qty").text == str(qty)

    @staticmethod
    def assert_order_bracket(driver, bracket: int):
        assert driver.find_element(By.ID, value="order_bracket").text == str(bracket)

    @staticmethod
    def assert_card_state(
        driver, slot: int, active_face: str, name: str, selected_image: int, total_images: int, source: str
    ):
        inactive_face = ({"front", "back"} - {active_face}).pop()
        counter = f"{selected_image}/{total_images}"
        assert driver.find_element(By.ID, value=f"slot{slot}-{active_face}").is_displayed() is True
        assert driver.find_element(By.ID, value=f"slot{slot}-{inactive_face}").is_displayed() is False
        assert driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-name").text == name
        assert driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-counter").text == counter
        assert source in driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-source").text

    # endregion

    # region tests

    def test_basic_search_and_xml_generation(self, elasticsearch, chrome_driver, live_server):
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()

        self.wait_for_search_results_modal(chrome_driver)

        self.assert_order_qty(chrome_driver, 7)
        self.assert_order_bracket(chrome_driver, 18)

        self.assert_card_state(chrome_driver, 0, "front", "Brainstorm", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 1, "front", "Brainstorm", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 2, "front", "Brainstorm", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 3, "front", "Brainstorm", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 4, "front", "Island", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 5, "front", "Island", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 6, "front", "Island", 1, 1, "Example Cards")

        self.generate_and_download_xml(chrome_driver)
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

        self.wait_for_search_results_modal(chrome_driver)

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

    def test_search_when_all_drives_disabled(self, elasticsearch, chrome_driver, live_server):
        chrome_driver.get(live_server.url)
        chrome_driver.find_element(By.ID, value="btn_settings").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value="example_cards").click()
        chrome_driver.find_element(By.ID, value="selectDrivesModal-submit").click()
        time.sleep(1)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()

        self.wait_for_search_results_modal(chrome_driver)

        # no search results
        for slot in range(0, 7):
            assert (
                chrome_driver.find_element(By.ID, value=f"slot{slot}-front-mpccard-source").text == "Your Search Query"
            )

    def test_upload_valid_xml(self, elasticsearch, chrome_driver, live_server, valid_xml):
        chrome_driver.get(live_server.url)
        chrome_driver.find_element(By.ID, value="xmlfile").send_keys(valid_xml)

        self.wait_for_search_results_modal(chrome_driver)

        self.assert_order_qty(chrome_driver, 7)
        self.assert_order_bracket(chrome_driver, 18)

        self.assert_card_state(chrome_driver, 0, "front", "Brainstorm", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 1, "front", "Brainstorm", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 2, "front", "Brainstorm", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 3, "front", "Brainstorm", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 4, "front", "Island", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 5, "front", "Island", 1, 1, "Example Cards")
        self.assert_card_state(chrome_driver, 6, "front", "Island", 1, 1, "Example Cards")

    def test_search_in_place(self, elasticsearch, chrome_driver, live_server):
        # TODO: can we create fixtures for search results to speed up these tests?
        # set up results page with single result
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("brainstorm")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        # assertions on the single result
        self.assert_order_qty(chrome_driver, 1)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(chrome_driver, 0, "front", "Brainstorm", 1, 1, "Example Cards")

        # search in-place
        card_name = chrome_driver.find_element(By.ID, value="slot0-front-mpccard-name")
        card_name.clear()
        card_name.send_keys("island")
        card_name.send_keys(Keys.ENTER)
        card_element = chrome_driver.find_element(By.ID, value="slot0-front")
        WebDriverWait(chrome_driver, 10).until(invisibility_of_element(card_element))
        WebDriverWait(chrome_driver, 10).until(visibility_of(card_element))

        # assertion on the changed card state
        self.assert_card_state(chrome_driver, 0, "front", "Island", 1, 1, "Example Cards")

    # endregion
