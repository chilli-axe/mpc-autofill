import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union

import pytest
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.expected_conditions import (
    invisibility_of_element,
    visibility_of,
)
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from django.core.management import call_command

from cardpicker.tests.constants import (
    TestCard,
    TestCards,
    TestDecks,
    TestSource,
    TestSources,
)


@dataclass
class TestSourceRow:
    key: str
    enabled: bool


class TestFrontend:
    # region fixtures
    @pytest.fixture(autouse=True)  # this is only auto-use within the scope of `TestFrontend`
    def populated_database(self, django_settings, stand_up_database):
        call_command("update_database")

    @pytest.fixture(scope="module")
    def download_folder(self, tmp_path_factory) -> Path:
        return tmp_path_factory.mktemp("downloads")

    @pytest.fixture()
    def chrome_driver_without_google_analytics_settings(self, download_folder, live_server) -> Chrome:
        options = Options()
        options.add_argument("--headless=new")
        options.add_experimental_option("prefs", {"download.default_directory": str(download_folder)})
        driver = Chrome(service=Service(ChromeDriverManager().install()), options=options)
        driver.set_window_size(1440, 900)
        driver.implicitly_wait(0)
        driver.get(live_server.url)
        yield driver
        driver.quit()

    @pytest.fixture()
    def chrome_driver(self, chrome_driver_without_google_analytics_settings) -> Chrome:
        chrome_driver_without_google_analytics_settings.add_cookie({"name": "ga_disabled", "value": "false"})
        yield chrome_driver_without_google_analytics_settings

    @pytest.fixture()
    def mobile_chrome_driver(self, live_server, download_folder) -> Chrome:
        options = Options()
        options.add_argument("--headless=new")
        options.add_experimental_option("mobileEmulation", {"deviceName": "iPhone X"})
        driver = Chrome(service=Service(ChromeDriverManager().install()), options=options)
        driver.implicitly_wait(0)
        driver.get(live_server.url)
        yield driver
        driver.quit()

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
                        <id>{TestCards.BRAINSTORM.value.identifier}</id>
                        <slots>0,1,2,3</slots>
                        <name>{TestCards.BRAINSTORM.value.name}.png</name>
                        <query>brainstorm</query>
                    </card>
                    <card>
                        <id>{TestCards.ISLAND.value.identifier}</id>
                        <slots>4,5,6</slots>
                        <name>{TestCards.ISLAND.value.name}.png</name>
                        <query>island</query>
                    </card>
                </fronts>
                <cardback>{TestCards.SIMPLE_CUBE.value.identifier}</cardback>
            </order>
            """
        valid_xml_path = str(download_folder / "valid_xml.xml")
        with open(valid_xml_path, "w") as f:
            f.write(xml_contents)
        yield valid_xml_path

    @pytest.fixture()
    def valid_csv(self, download_folder):
        csv_contents = """
            quantity,front,back
            4,brainstorm,
            3,island,
            """
        valid_csv_path = str(download_folder / "valid_csv.csv")
        with open(valid_csv_path, "w") as f:
            f.write(csv_contents)
        yield valid_csv_path

    @pytest.fixture()
    def xml_with_invalid_card(self, download_folder):
        xml_contents = f"""
                <order>
                    <details>
                        <quantity>1</quantity>
                        <bracket>18</bracket>
                        <stock>(S30) Standard Smooth</stock>
                        <foil>false</foil>
                    </details>
                    <fronts>
                        <card>
                            <id>invalid</id>
                            <slots>0</slots>
                            <name>{TestCards.BRAINSTORM.value.name}.png</name>
                            <query>brainstorm</query>
                        </card>
                    </fronts>
                    <cardback>{TestCards.SIMPLE_CUBE.value.identifier}</cardback>
                </order>
                """
        xml_with_invalid_card_path = str(download_folder / "xml_with_invalid_card.xml")
        with open(xml_with_invalid_card_path, "w") as f:
            f.write(xml_contents)
        yield xml_with_invalid_card_path

    # endregion

    # region helpers
    @staticmethod
    def wait_for_search_results_modal(driver):
        load_modal = driver.find_element(By.ID, value="loadModal")
        if load_modal.is_displayed():
            WebDriverWait(driver, 10).until(visibility_of(load_modal))
        if not load_modal.is_displayed():
            WebDriverWait(driver, 10).until(invisibility_of_element(load_modal))
        time.sleep(2)

    @classmethod
    def load_review_page_with_search_string(cls, driver, search_string):
        text_area = driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys(search_string)
        driver.find_element(By.ID, value="btn_submit").click()
        cls.wait_for_search_results_modal(driver)

    @staticmethod
    def generate_and_download_xml(driver):
        driver.find_element(By.ID, value="btn_generate_xml").click()
        time.sleep(1)

    @staticmethod
    def search_in_place(driver, slot: int, face: str, search_query: Optional[str]):
        card_name = driver.find_element(By.ID, value=f"slot{slot}-{face}-mpccard-name")
        card_name.clear()
        if search_query is not None:
            card_name.send_keys(search_query)
        card_name.send_keys(Keys.ENTER)
        time.sleep(5)

    @staticmethod
    def get_ids_of_all_cards_with_name(driver, name) -> list[str]:
        return [x.get_attribute("id") for x in driver.find_elements(By.XPATH, value=f"//*[text() = '{name}']/../..")]

    @staticmethod
    def get_slot_from_id(id_: str) -> int:
        return int(re.search(r"^slot(\d.*)-front|back$", id_).groups()[0])

    @staticmethod
    def assert_order_qty(driver, qty: int):
        assert driver.find_element(By.ID, value="order_qty").text == str(qty)

    @staticmethod
    def assert_order_bracket(driver, bracket: int):
        assert driver.find_element(By.ID, value="order_bracket").text == str(bracket)

    @staticmethod
    def assert_card_state(
        driver,
        slot: Union[int, str],
        active_face: str,
        card: TestCard,
        selected_image: Optional[int],
        total_images: Optional[int],
        source: TestSource,
        has_reverse_face: bool = True,
    ):
        if has_reverse_face:
            inactive_face = ({"front", "back"} - {active_face}).pop()
            assert (
                driver.find_element(By.ID, value=f"slot{slot}-{inactive_face}").is_displayed() is False
            ), f"Expected the face {inactive_face} for card {card.name} to be hidden!"

        assert (
            driver.find_element(By.ID, value=f"slot{slot}-{active_face}").is_displayed() is True
        ), f"Expected the face {active_face} for card {card.name} to be visible!"
        assert driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-name").text == card.name
        if selected_image is not None and total_images is not None:
            counter = f"{selected_image}/{total_images}"
            assert (
                driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-counter").text
                or driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-counter-btn").text
            ) == counter
        assert source.name in driver.find_element(By.ID, value=f"slot{slot}-{active_face}-mpccard-source").text

    @staticmethod
    def assert_search_settings(driver, test_source_rows: list[TestSourceRow]) -> None:
        driver.find_element(By.ID, value="btn_settings").click()
        time.sleep(1)
        table_rows = driver.find_element(By.ID, value="drive-order-tbody").find_elements(By.XPATH, value="*")
        assert [x.get_attribute("id") for x in table_rows] == [f"{x.key}-row" for x in test_source_rows]
        for test_source_row in test_source_rows:
            assert (
                driver.find_element(By.ID, value=test_source_row.key).get_attribute("checked") == "true"
            ) == test_source_row.enabled

    @staticmethod
    def toggle_faces(driver):
        driver.find_element(By.ID, value="switchFacesBtn").click()
        time.sleep(3)

    # endregion

    # region tests

    @pytest.mark.parametrize("url", ["", "contributions", "new", "legal", "guide"])
    def test_views(self, client, live_server, url):
        response = client.get(f"{live_server.url}/{url}")
        assert response.status_code == 200

    # TODO: replicate this test in the new frontend
    def test_basic_search_and_xml_generation(self, chrome_driver, download_folder, snapshot):
        self.load_review_page_with_search_string(chrome_driver, "4 brainstorm\n3 island")

        self.assert_order_qty(chrome_driver, 7)
        self.assert_order_bracket(chrome_driver, 18)
        for i in range(0, 4):
            self.assert_card_state(
                chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.BRAINSTORM.value,
                selected_image=1,
                total_images=1,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        for i in range(4, 7):
            self.assert_card_state(
                chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.ISLAND.value,
                selected_image=1,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )

        self.generate_and_download_xml(chrome_driver)
        with open(download_folder / "cards.xml", "r") as f:
            assert str(f.read()) == snapshot

    # TODO: replicate this test in the new frontend
    def test_toggle_faces(self, chrome_driver):
        self.load_review_page_with_search_string(chrome_driver, "4 brainstorm\n3 island")

        for i in range(0, 7):
            assert chrome_driver.find_element(By.ID, value=f"slot{i}-front").is_displayed() is True
            assert chrome_driver.find_element(By.ID, value=f"slot{i}-back").is_displayed() is False
        self.toggle_faces(chrome_driver)
        for i in range(0, 7):
            assert chrome_driver.find_element(By.ID, value=f"slot{i}-front").is_displayed() is False
            assert chrome_driver.find_element(By.ID, value=f"slot{i}-back").is_displayed() is True

    # TODO: replicate this test in the new frontend
    def test_card_version_selection(self, chrome_driver):
        self.load_review_page_with_search_string(chrome_driver, "2 island\n2 past in flames")

        # change version without locking
        for i in range(0, 2):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.ISLAND.value,
                selected_image=1,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        chrome_driver.find_element(By.ID, value="slot1-front-next").click()
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=1,
            active_face="front",
            card=TestCards.ISLAND_CLASSICAL.value,
            selected_image=2,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        chrome_driver.find_element(By.ID, value="slot0-front-prev").click()
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.ISLAND_CLASSICAL.value,
            selected_image=2,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.ISLAND_CLASSICAL.value,
            selected_image=2,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

        # change version with the `next` button while locking
        for i in range(2, 4):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.PAST_IN_FLAMES_1.value,
                selected_image=1,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        chrome_driver.find_element(By.ID, value="slot3-front-padlock").click()
        chrome_driver.find_element(By.ID, value="slot3-front-next").click()
        for i in range(2, 4):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.PAST_IN_FLAMES_2.value,
                selected_image=2,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_2.value,
            )
        chrome_driver.find_element(By.ID, value="slot2-front-prev").click()
        for i in range(2, 4):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.PAST_IN_FLAMES_1.value,
                selected_image=1,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )

        # change version with the modal view
        chrome_driver.find_element(By.ID, value="slot3-front-mpccard-counter-btn").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value=f"{TestCards.PAST_IN_FLAMES_2.value.identifier}-card-img").click()
        time.sleep(1)
        for i in range(2, 4):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.PAST_IN_FLAMES_2.value,
                selected_image=2,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_2.value,
            )

    # TODO: replicate this test in the new frontend
    def test_fuzzy_search(self, chrome_driver):
        chrome_driver.find_element(By.ID, value="btn_settings").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value="searchtype").find_element(By.XPATH, value="./..").click()
        chrome_driver.find_element(By.ID, value="selectDrivesModal-submit").click()
        time.sleep(1)
        self.load_review_page_with_search_string(chrome_driver, "past in")

        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.PAST_IN_FLAMES_1.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_search_when_all_drives_disabled(self, chrome_driver):
        chrome_driver.find_element(By.ID, value="btn_settings").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value=TestSources.EXAMPLE_DRIVE_1.value.key).find_element(
            By.XPATH, value="./.."
        ).click()
        chrome_driver.find_element(By.ID, value=TestSources.EXAMPLE_DRIVE_2.value.key).find_element(
            By.XPATH, value="./.."
        ).click()
        chrome_driver.find_element(By.ID, value="selectDrivesModal-submit").click()
        time.sleep(1)
        self.load_review_page_with_search_string(chrome_driver, "4 brainstorm\n3 island")

        # no search results
        for slot in range(0, 7):
            assert (
                chrome_driver.find_element(By.ID, value=f"slot{slot}-front-mpccard-source").text == "Your Search Query"
            )

    # TODO: replicate this test in the new frontend
    def test_upload_valid_file(self, chrome_driver, live_server, valid_xml, valid_csv):
        for element_id, file_path in [("xmlfile", valid_xml), ("csvfile", valid_csv)]:
            chrome_driver.get(live_server.url)
            chrome_driver.find_element(By.ID, value=element_id).send_keys(file_path)

            self.wait_for_search_results_modal(chrome_driver)

            self.assert_order_qty(chrome_driver, 7)
            self.assert_order_bracket(chrome_driver, 18)

            for i in range(0, 4):
                self.assert_card_state(
                    driver=chrome_driver,
                    slot=i,
                    active_face="front",
                    card=TestCards.BRAINSTORM.value,
                    selected_image=1,
                    total_images=1,
                    source=TestSources.EXAMPLE_DRIVE_1.value,
                )
            for i in range(4, 7):
                self.assert_card_state(
                    driver=chrome_driver,
                    slot=i,
                    active_face="front",
                    card=TestCards.ISLAND.value,
                    selected_image=1,
                    total_images=2,
                    source=TestSources.EXAMPLE_DRIVE_1.value,
                )

    # TODO: replicate this test in the new frontend
    @pytest.mark.parametrize(
        "from_query, from_card, to_query, to_card",
        [
            ("brainstorm", TestCards.BRAINSTORM.value, "mountain", TestCards.MOUNTAIN.value),
            ("brainstorm", TestCards.BRAINSTORM.value, "t:goblin", TestCards.GOBLIN.value),
            ("t:goblin", TestCards.GOBLIN.value, "brainstorm", TestCards.BRAINSTORM.value),
        ],
    )
    def test_search_in_place(self, chrome_driver, from_query, from_card, to_query, to_card):
        # set up results page with single result
        self.load_review_page_with_search_string(chrome_driver, from_query)

        # assertions on the single result
        self.assert_order_qty(chrome_driver, 1)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=from_card,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

        # search in-place
        self.search_in_place(driver=chrome_driver, slot=0, face="front", search_query=to_query)

        # assertion on the changed card state
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=to_card,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_dfc_search(self, chrome_driver):
        call_command("update_dfcs")
        # set up results page with single result
        self.load_review_page_with_search_string(chrome_driver, "huntmaster of the fells")

        self.assert_order_qty(chrome_driver, 1)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.HUNTMASTER_OF_THE_FELLS.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.toggle_faces(chrome_driver)
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="back",
            card=TestCards.RAVAGER_OF_THE_FELLS.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_priority_ordering(self, chrome_driver):
        self.load_review_page_with_search_string(chrome_driver, "island")

        self.assert_card_state(
            chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        chrome_driver.find_element(By.ID, value="slot0-front-next").click()
        self.assert_card_state(
            chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.ISLAND_CLASSICAL.value,
            selected_image=2,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_source_default_ordering(self, chrome_driver):
        self.load_review_page_with_search_string(chrome_driver, "past in flames")

        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.PAST_IN_FLAMES_1.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_source_non_default_ordering(self, chrome_driver):
        chrome_driver.find_element(By.ID, value="btn_settings").click()
        time.sleep(1)
        action = ActionChains(chrome_driver)
        action.drag_and_drop_by_offset(
            source=chrome_driver.find_element(By.ID, value=f"{TestSources.EXAMPLE_DRIVE_2.value.key}-row"),
            xoffset=30,
            yoffset=-70,
        ).perform()
        chrome_driver.find_element(By.ID, value="selectDrivesModal-submit").click()
        time.sleep(1)

        self.load_review_page_with_search_string(chrome_driver, "past in flames")

        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.PAST_IN_FLAMES_2.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_2.value,
        )

    # TODO: replicate this test in the new frontend
    def test_disabling_a_drive_saved_by_cookie(self, chrome_driver):
        chrome_driver.find_element(By.ID, value="btn_settings").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value=TestSources.EXAMPLE_DRIVE_2.value.key).find_element(
            By.XPATH, value="./.."
        ).click()
        chrome_driver.find_element(By.ID, value="selectDrivesModal-submit").click()
        time.sleep(1)
        chrome_driver.refresh()

        self.assert_search_settings(
            chrome_driver,
            [
                TestSourceRow(key=TestSources.EXAMPLE_DRIVE_1.value.key, enabled=True),
                TestSourceRow(key=TestSources.EXAMPLE_DRIVE_2.value.key, enabled=False),
            ],
        )

    # TODO: replicate this test in the new frontend
    def test_reordering_drives_saved_by_cookie(self, chrome_driver):
        chrome_driver.find_element(By.ID, value="btn_settings").click()
        time.sleep(1)
        action = ActionChains(chrome_driver)
        action.drag_and_drop_by_offset(
            source=chrome_driver.find_element(By.ID, value=f"{TestSources.EXAMPLE_DRIVE_2.value.key}-row"),
            xoffset=30,
            yoffset=-70,
        ).perform()
        chrome_driver.find_element(By.ID, value="selectDrivesModal-submit").click()
        time.sleep(1)
        chrome_driver.refresh()

        self.assert_search_settings(
            chrome_driver,
            [
                TestSourceRow(key=TestSources.EXAMPLE_DRIVE_2.value.key, enabled=True),
                TestSourceRow(key=TestSources.EXAMPLE_DRIVE_1.value.key, enabled=True),
            ],
        )

    # TODO: replicate this test in the new frontend
    def test_cleared_card_back_name_defaulting_to_selected_common_card_back(self, chrome_driver):
        self.load_review_page_with_search_string(chrome_driver, "brainstorm")

        self.toggle_faces(chrome_driver)
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="back",
            card=TestCards.SIMPLE_CUBE.value,
            selected_image=None,
            total_images=None,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot="-",
            active_face="back",
            card=TestCards.SIMPLE_CUBE.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
            has_reverse_face=False,
        )

        chrome_driver.find_element(By.ID, value="slot--back-next").click()
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="back",
            card=TestCards.SIMPLE_LOTUS.value,
            selected_image=None,
            total_images=None,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot="-",
            active_face="back",
            card=TestCards.SIMPLE_LOTUS.value,
            selected_image=2,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
            has_reverse_face=False,
        )

        self.search_in_place(driver=chrome_driver, slot=0, face="back", search_query=None)

        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="back",
            card=TestCards.SIMPLE_LOTUS.value,
            selected_image=None,
            total_images=None,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_detailed_view_modal(self, chrome_driver):
        self.load_review_page_with_search_string(chrome_driver, "brainstorm")

        # bring up modal
        chrome_driver.find_element(By.ID, value="slot0-front-card-img").click()
        time.sleep(1)

        # assert modal contents
        assert (
            chrome_driver.find_element(By.ID, value="detailedView-img").get_attribute("src")
            == f"https://drive.google.com/thumbnail?sz=w800-h800&id={TestCards.BRAINSTORM.value.identifier}"
        )
        source_element = chrome_driver.find_element(By.ID, value="detailedView-source")
        assert source_element.text == TestSources.EXAMPLE_DRIVE_1.value.name
        assert (
            source_element.find_element(By.XPATH, value=".//a").get_attribute("href")
            == f"https://drive.google.com/open?id={TestSources.EXAMPLE_DRIVE_1.value.identifier}"
        )
        assert chrome_driver.find_element(By.ID, value="detailedView-sourceType").text == "Google Drive"
        assert chrome_driver.find_element(By.ID, value="detailedView-class").text == "Card"
        assert chrome_driver.find_element(By.ID, value="detailedView-id").text == TestCards.BRAINSTORM.value.identifier

    # TODO: replicate this test in the new frontend
    def test_delete_card_from_order(self, chrome_driver):
        self.load_review_page_with_search_string(chrome_driver, "2 brainstorm\n1 island")

        self.assert_order_qty(chrome_driver, 3)
        self.assert_order_bracket(chrome_driver, 18)
        for i in range(0, 2):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.BRAINSTORM.value,
                selected_image=1,
                total_images=1,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        self.assert_card_state(
            driver=chrome_driver,
            slot=2,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

        chrome_driver.find_element(By.ID, value="slot1-front-remove").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value="btn_confirm_remove_card").click()

        self.assert_order_qty(chrome_driver, 2)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=1,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_delete_multiple_cards_from_order(self, chrome_driver):
        self.load_review_page_with_search_string(chrome_driver, "2 brainstorm\n2 past in flames")

        self.assert_order_qty(chrome_driver, 4)
        self.assert_order_bracket(chrome_driver, 18)
        for i in range(0, 2):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.BRAINSTORM.value,
                selected_image=1,
                total_images=1,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        for i in range(2, 4):
            self.assert_card_state(
                driver=chrome_driver,
                slot=2,
                active_face="front",
                card=TestCards.PAST_IN_FLAMES_1.value,
                selected_image=1,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )

        chrome_driver.find_element(By.ID, value="slot1-front-remove").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value="btn_confirm_remove_card_no_reminder").click()
        chrome_driver.find_element(By.ID, value="slot1-front-remove").click()

        self.assert_order_qty(chrome_driver, 2)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=1,
            active_face="front",
            card=TestCards.PAST_IN_FLAMES_1.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_download_single_image(self, chrome_driver, download_folder):
        self.load_review_page_with_search_string(chrome_driver, "brainstorm")

        # bring up modal and download the image
        chrome_driver.find_element(By.ID, value="slot0-front-card-img").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value="detailedView-dl").click()
        time.sleep(5)

        # assert the expected image has been downloaded
        os.path.exists(download_folder / "Brainstorm.png")

    # TODO: replicate this test in the new frontend
    def test_download_all_images(self, chrome_driver, download_folder):
        self.load_review_page_with_search_string(chrome_driver, "4 brainstorm\n3 island\nhuntmaster of the fells")

        # download all images
        chrome_driver.find_element(By.ID, value="btn_download_all").click()
        time.sleep(10)

        # assert the expected images have been downloaded
        for expected_file in [
            f"{TestCards.BRAINSTORM.value.name}.png",
            f"{TestCards.ISLAND.value.name}.png",
            f"{TestCards.HUNTMASTER_OF_THE_FELLS.value.name}.png",
            f"{TestCards.RAVAGER_OF_THE_FELLS.value.name}.png",
            f"{TestCards.SIMPLE_CUBE.value.name}.png",
        ]:
            os.path.exists(download_folder / expected_file)

    # TODO: replicate this test in the new frontend
    @pytest.mark.parametrize("url", [x.value for x in TestDecks])
    def test_import_from_url(self, chrome_driver, url):
        call_command("update_dfcs")
        chrome_driver.find_element(By.ID, value="uploadCardsBtn").click()
        chrome_driver.find_element(By.ID, value="input_url").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value="list_url").send_keys(url)
        chrome_driver.find_element(By.ID, value="inputLinkModal-submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        # each site might return the cards in the deck in a different order
        brainstorm_slots = [
            self.get_slot_from_id(id_)
            for id_ in self.get_ids_of_all_cards_with_name(chrome_driver, TestCards.BRAINSTORM.value.name)
        ]
        past_in_flames_slots = [
            self.get_slot_from_id(id_)
            for id_ in self.get_ids_of_all_cards_with_name(chrome_driver, TestCards.PAST_IN_FLAMES_1.value.name)
        ]
        delver_of_secrets_slots = [
            self.get_slot_from_id(id_)
            for id_ in self.get_ids_of_all_cards_with_name(chrome_driver, TestCards.DELVER_OF_SECRETS.value.name)
        ]

        self.assert_order_qty(chrome_driver, 8)
        self.assert_order_bracket(chrome_driver, 18)
        assert len(brainstorm_slots) == 4
        assert len(past_in_flames_slots) == 3
        assert len(delver_of_secrets_slots) == 1

        for slot in brainstorm_slots:
            self.assert_card_state(
                driver=chrome_driver,
                slot=slot,
                active_face="front",
                card=TestCards.BRAINSTORM.value,
                selected_image=1,
                total_images=1,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        for slot in past_in_flames_slots:
            self.assert_card_state(
                driver=chrome_driver,
                slot=slot,
                active_face="front",
                card=TestCards.PAST_IN_FLAMES_1.value,
                selected_image=1,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        self.assert_card_state(
            driver=chrome_driver,
            slot=delver_of_secrets_slots[0],
            active_face="front",
            card=TestCards.DELVER_OF_SECRETS.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.toggle_faces(chrome_driver)
        for slot in brainstorm_slots + past_in_flames_slots:
            self.assert_card_state(
                driver=chrome_driver,
                slot=slot,
                active_face="back",
                card=TestCards.SIMPLE_CUBE.value,
                selected_image=None,
                total_images=None,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        self.assert_card_state(
            driver=chrome_driver,
            slot=delver_of_secrets_slots[0],
            active_face="back",
            card=TestCards.INSECTILE_ABERRATION.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    # TODO: replicate this test in the new frontend
    def test_missing_cards_modal(self, chrome_driver, xml_with_invalid_card):
        chrome_driver.find_element(By.ID, value="xmlfile").send_keys(xml_with_invalid_card)
        self.wait_for_search_results_modal(chrome_driver)
        time.sleep(1)

        assert chrome_driver.find_element(By.ID, value="missingCardsModal").is_displayed()
        row_elements = chrome_driver.find_element(By.ID, value="missingCardsTable").find_elements(
            By.XPATH, value=".//tr"
        )
        assert len(row_elements) == 1
        row_element = row_elements.pop()
        cell_elements = row_element.find_elements(By.XPATH, value=".//td")
        assert len(cell_elements) == 4
        identifier_cell, slot_cell, face_cell, search_query_cell = cell_elements
        assert identifier_cell.text == "invalid"
        assert slot_cell.text == "1"
        assert face_cell.text == "front"
        assert search_query_cell.text == "brainstorm"

    # TODO: replicate this test in the new frontend
    def test_add_cards_to_order_by_text(self, chrome_driver):
        call_command("update_dfcs")
        self.load_review_page_with_search_string(chrome_driver, "brainstorm")

        self.assert_order_qty(chrome_driver, 1)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

        chrome_driver.find_element(By.ID, value="addCardsBtn").click()
        chrome_driver.find_element(By.ID, value="btn_add_cards_text_input").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value="id_card_list").send_keys("2 huntmaster of the fells")
        chrome_driver.find_element(By.ID, value="btn_add_cards_submit").click()
        time.sleep(5)

        self.assert_order_qty(chrome_driver, 3)
        self.assert_order_bracket(chrome_driver, 18)
        for i in range(1, 3):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.HUNTMASTER_OF_THE_FELLS.value,
                selected_image=1,
                total_images=1,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        self.toggle_faces(chrome_driver)
        for i in range(1, 3):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="back",
                card=TestCards.RAVAGER_OF_THE_FELLS.value,
                selected_image=1,
                total_images=1,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )

    # TODO: replicate this test in the new frontend
    def test_add_cards_to_order_by_xml(self, chrome_driver, valid_xml):
        self.load_review_page_with_search_string(chrome_driver, "past in flames")

        self.assert_order_qty(chrome_driver, 1)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.PAST_IN_FLAMES_1.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

        chrome_driver.find_element(By.ID, value="addCardsBtn").click()
        chrome_driver.find_element(By.ID, value="xmlfile").send_keys(valid_xml)
        time.sleep(5)

        self.assert_order_qty(chrome_driver, 8)
        self.assert_order_bracket(chrome_driver, 18)
        for i in range(1, 5):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.BRAINSTORM.value,
                selected_image=1,
                total_images=1,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )
        for i in range(5, 8):
            self.assert_card_state(
                driver=chrome_driver,
                slot=i,
                active_face="front",
                card=TestCards.ISLAND.value,
                selected_image=1,
                total_images=2,
                source=TestSources.EXAMPLE_DRIVE_1.value,
            )

    # TODO: replicate this test in the new frontend
    def test_mobile_banner(self, mobile_chrome_driver):
        assert (
            "It seems like you're on a mobile device!"
            in mobile_chrome_driver.find_element(By.ID, "mobile-device-alert").text
        )

    # endregion
