import re
import time
from pathlib import Path

import pytest
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

from django.core.management import call_command

from cardpicker.sources.source_types import SourceTypeChoices
from cardpicker.tests.factories import SourceFactory


class TestFrontend:
    # region constants

    BRAINSTORM = "Brainstorm"
    BRAINSTORM_ID = "1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5"
    ISLAND = "Island"
    ISLAND_ID = "1IDtqSjJ4Yo45AnNA4SplOiN7ewibifMa"
    SIMPLE_CUBE = "Simple Cube"  # default back
    SIMPLE_CUBE_ID = "1JtXL6Ca9nQkvhwZZRR9ZuKA9_DzsFf1V"
    HUNTMASTER_OF_THE_FELLS = "Huntmaster of the Fells"
    RAVAGER_OF_THE_FELLS = "Ravager of the Fells"

    EXAMPLE_DRIVE_1 = "Example Drive 1"
    EXAMPLE_DRIVE_1_KEY = "example_drive_1"

    # endregion

    # region fixtures

    @pytest.fixture(scope="module")
    def download_folder(self, tmp_path_factory) -> Path:
        return tmp_path_factory.mktemp("downloads")

    @pytest.fixture()
    def chrome_driver(self, download_folder) -> Chrome:
        options = Options()
        options.add_argument("--headless")
        options.add_experimental_option("prefs", {"download.default_directory": str(download_folder)})
        driver = Chrome(service=Service(ChromeDriverManager().install()), options=options)
        driver.set_window_size(1440, 900)
        driver.implicitly_wait(0)
        yield driver
        driver.quit()

    @pytest.fixture(autouse=True)  # only auto-used within the scope of this class
    def django_settings(self, db, settings):
        settings.DEBUG = True
        settings.DEFAULT_CARDBACK_IMAGE_NAME = self.SIMPLE_CUBE

    @pytest.fixture(scope="module")
    def elasticsearch(self):
        """
        This fixture expects elasticsearch to be running on your machine.
        """

        return factories.elasticsearch("elasticsearch_nooproc")

    @pytest.fixture(autouse=True)
    def stand_up_database(self, elasticsearch) -> None:
        SourceFactory(
            key=self.EXAMPLE_DRIVE_1_KEY,
            name=self.EXAMPLE_DRIVE_1,
            identifier="1Fu2nEymZhCpOOZkfF0XoZsVqdIWmPdNq",
            source_type=SourceTypeChoices.GOOGLE_DRIVE,
        )
        call_command("update_database")

    @pytest.fixture()
    def valid_xml(self, download_folder):
        xml_contents = f"""
            <order>
                <details>
                    <quantity>7</quantity>
                    <bracket>18</bracket>
                    <stock>(S30) Standard Smooth</stock>
                    <foil>false</foil>
                </details>
                <fronts>
                    <card>
                        <id>{self.BRAINSTORM_ID}</id>
                        <slots>1,2,0,3</slots>
                        <name>{self.BRAINSTORM}.png</name>
                        <query>brainstorm</query>
                    </card>
                    <card>
                        <id>{self.ISLAND_ID}</id>
                        <slots>4,5,6</slots>
                        <name>{self.ISLAND}.png</name>
                        <query>island</query>
                    </card>
                </fronts>
                <cardback>{self.SIMPLE_CUBE_ID}</cardback>
            </order>
            """
        valid_xml_path = str(download_folder / "valid_xml.xml")
        with open(valid_xml_path, "w") as f:
            f.write(xml_contents)
        yield valid_xml_path

    # endregion

    # region helpers
    @staticmethod
    def wait_for_search_results_modal(driver):
        load_modal = driver.find_element(By.ID, value="loadModal")
        WebDriverWait(driver, 10).until(visibility_of(load_modal))
        WebDriverWait(driver, 10).until(invisibility_of_element(load_modal))
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
        assert (
            driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-counter").text
            or driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-counter-btn").text
        ) == counter
        assert source in driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-source").text

    @staticmethod
    def toggle_faces(driver):
        driver.find_element(By.ID, value="switchFacesBtn").click()
        time.sleep(3)

    # endregion

    # region tests

    def test_basic_search_and_xml_generation(self, chrome_driver, live_server, download_folder):
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()

        self.wait_for_search_results_modal(chrome_driver)

        self.assert_order_qty(chrome_driver, 7)
        self.assert_order_bracket(chrome_driver, 18)

        self.assert_card_state(chrome_driver, 0, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 1, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 2, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 3, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 4, "front", self.ISLAND, 1, 2, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 5, "front", self.ISLAND, 1, 2, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 6, "front", self.ISLAND, 1, 2, self.EXAMPLE_DRIVE_1)

        self.generate_and_download_xml(chrome_driver)
        with open(download_folder / "cards.xml", "r") as f:
            assert re.sub(r"[\n\t\s]*", "", str(f.read())) == re.sub(
                r"[\n\t\s]*",
                "",
                (
                    f"""
                <order>
                    <details>
                        <quantity>7</quantity>
                        <bracket>18</bracket>
                        <stock>(S30) Standard Smooth</stock>
                        <foil>false</foil>
                    </details>
                    <fronts>
                        <card>
                            <id>{self.BRAINSTORM_ID}</id>
                            <slots>1,2,0,3</slots>
                            <name>{self.BRAINSTORM}.png</name>
                            <query>brainstorm</query>
                        </card>
                        <card>
                            <id>{self.ISLAND_ID}</id>
                            <slots>4,5,6</slots>
                            <name>{self.ISLAND}.png</name>
                            <query>island</query>
                        </card>
                    </fronts>
                    <cardback>{self.SIMPLE_CUBE_ID}</cardback>
                </order>
                """
                ),
            )

    def test_toggle_faces(self, chrome_driver, live_server):
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        for i in range(0, 7):
            assert chrome_driver.find_element(By.ID, value=f"slot{i}-front").is_displayed() is True
            assert chrome_driver.find_element(By.ID, value=f"slot{i}-back").is_displayed() is False
        self.toggle_faces(chrome_driver)
        for i in range(0, 7):
            assert chrome_driver.find_element(By.ID, value=f"slot{i}-front").is_displayed() is False
            assert chrome_driver.find_element(By.ID, value=f"slot{i}-back").is_displayed() is True

    def test_search_when_all_drives_disabled(self, chrome_driver, live_server):
        chrome_driver.get(live_server.url)
        chrome_driver.find_element(By.ID, value="btn_settings").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value=self.EXAMPLE_DRIVE_1_KEY).click()
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

    def test_upload_valid_xml(self, chrome_driver, live_server, valid_xml):
        chrome_driver.get(live_server.url)
        chrome_driver.find_element(By.ID, value="xmlfile").send_keys(valid_xml)

        self.wait_for_search_results_modal(chrome_driver)

        self.assert_order_qty(chrome_driver, 7)
        self.assert_order_bracket(chrome_driver, 18)

        self.assert_card_state(chrome_driver, 0, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 1, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 2, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 3, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 4, "front", self.ISLAND, 1, 2, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 5, "front", self.ISLAND, 1, 2, self.EXAMPLE_DRIVE_1)
        self.assert_card_state(chrome_driver, 6, "front", self.ISLAND, 1, 2, self.EXAMPLE_DRIVE_1)

    def test_search_in_place(self, chrome_driver, live_server):
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
        self.assert_card_state(chrome_driver, 0, "front", self.BRAINSTORM, 1, 1, self.EXAMPLE_DRIVE_1)

        # search in-place
        card_name = chrome_driver.find_element(By.ID, value="slot0-front-mpccard-name")
        card_name.clear()
        card_name.send_keys("island")
        card_name.send_keys(Keys.ENTER)
        card_element = chrome_driver.find_element(By.ID, value="slot0-front")
        WebDriverWait(chrome_driver, 10).until(invisibility_of_element(card_element))
        WebDriverWait(chrome_driver, 10).until(visibility_of(card_element))

        # assertion on the changed card state
        self.assert_card_state(chrome_driver, 0, "front", self.ISLAND, 1, 2, self.EXAMPLE_DRIVE_1)

    def test_dfc_search(self, chrome_driver, live_server):
        call_command("update_dfcs")
        # set up results page with single result
        chrome_driver.get(live_server.url)
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("huntmaster of the fells")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        self.assert_order_qty(chrome_driver, 1)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(chrome_driver, 0, "front", self.HUNTMASTER_OF_THE_FELLS, 1, 1, self.EXAMPLE_DRIVE_1)
        self.toggle_faces(chrome_driver)
        self.assert_card_state(chrome_driver, 0, "back", self.RAVAGER_OF_THE_FELLS, 1, 1, self.EXAMPLE_DRIVE_1)

    # endregion
