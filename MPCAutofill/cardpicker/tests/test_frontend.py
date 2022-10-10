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
    def chrome_driver(self, download_folder, live_server) -> Chrome:
        options = Options()
        options.add_argument("--headless")
        options.add_experimental_option("prefs", {"download.default_directory": str(download_folder)})
        driver = Chrome(service=Service(ChromeDriverManager().install()), options=options)
        driver.set_window_size(1440, 900)
        driver.implicitly_wait(0)
        driver.get(live_server.url)
        yield driver
        driver.quit()

    @pytest.fixture()
    def mobile_chrome_driver(self, live_server, download_folder) -> Chrome:
        options = Options()
        options.add_argument("--headless")
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
                        <slots>1,2,0,3</slots>
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
        table_rows = driver.find_element(By.ID, value="search-settings-table").find_elements(By.XPATH, value="*")
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

    def test_basic_search_and_xml_generation(self, chrome_driver, download_folder, snapshot):
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        self.assert_order_qty(chrome_driver, 7)
        self.assert_order_bracket(chrome_driver, 18)
        self.assert_card_state(
            chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            chrome_driver,
            slot=1,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            chrome_driver,
            slot=2,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            chrome_driver,
            slot=3,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            chrome_driver,
            slot=4,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            chrome_driver,
            slot=5,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            chrome_driver,
            slot=6,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

        self.generate_and_download_xml(chrome_driver)
        with open(download_folder / "cards.xml", "r") as f:
            assert str(f.read()) == snapshot

    def test_toggle_faces(self, chrome_driver):
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

    def test_card_version_selection(self, chrome_driver):
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("2 island\n2 past in flames")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

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
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()

        self.wait_for_search_results_modal(chrome_driver)

        # no search results
        for slot in range(0, 7):
            assert (
                chrome_driver.find_element(By.ID, value=f"slot{slot}-front-mpccard-source").text == "Your Search Query"
            )

    def test_upload_valid_xml(self, chrome_driver, valid_xml):
        chrome_driver.find_element(By.ID, value="xmlfile").send_keys(valid_xml)

        self.wait_for_search_results_modal(chrome_driver)

        self.assert_order_qty(chrome_driver, 7)
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
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=2,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=3,
            active_face="front",
            card=TestCards.BRAINSTORM.value,
            selected_image=1,
            total_images=1,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=4,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=5,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )
        self.assert_card_state(
            driver=chrome_driver,
            slot=6,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    def test_search_in_place(self, chrome_driver):
        # TODO: can we create fixtures for search results to speed up these tests?
        # set up results page with single result

        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("brainstorm")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        # assertions on the single result
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

        # search in-place
        self.search_in_place(driver=chrome_driver, slot=0, face="front", search_query="island")

        # assertion on the changed card state
        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.ISLAND.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

    def test_dfc_search(self, chrome_driver):
        call_command("update_dfcs")
        # set up results page with single result
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("huntmaster of the fells")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

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

    def test_priority_ordering(self, chrome_driver):
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("island")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

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

    def test_source_default_ordering(self, chrome_driver):
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("past in flames")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.PAST_IN_FLAMES_1.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_1.value,
        )

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

        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("past in flames")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        self.assert_card_state(
            driver=chrome_driver,
            slot=0,
            active_face="front",
            card=TestCards.PAST_IN_FLAMES_2.value,
            selected_image=1,
            total_images=2,
            source=TestSources.EXAMPLE_DRIVE_2.value,
        )

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

    def test_cleared_card_back_name_defaulting_to_selected_common_card_back(self, chrome_driver):
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("brainstorm")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)
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

    def test_detailed_view_modal(self, chrome_driver):
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("brainstorm")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        # bring up modal
        chrome_driver.find_element(By.ID, value="slot0-front-card-img").click()
        time.sleep(1)

        # assert modal contents
        assert (
            chrome_driver.find_element(By.ID, value="detailedView-img").get_attribute("src")
            == f"https://drive.google.com/thumbnail?sz=w800-h800&id={TestCards.BRAINSTORM.value.identifier}"
        )
        assert (
            chrome_driver.find_element(By.ID, value="detailedView-source").text
            == TestSources.EXAMPLE_DRIVE_1.value.name
        )
        assert chrome_driver.find_element(By.ID, value="detailedView-sourceType").text == "Google Drive"
        assert chrome_driver.find_element(By.ID, value="detailedView-class").text == "Card"
        assert chrome_driver.find_element(By.ID, value="detailedView-id").text == TestCards.BRAINSTORM.value.identifier

    def test_download_single_image(self, chrome_driver, download_folder):
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("brainstorm")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

        # bring up modal and download the image
        chrome_driver.find_element(By.ID, value="slot0-front-card-img").click()
        time.sleep(1)
        chrome_driver.find_element(By.ID, value="detailedView-dl").click()
        time.sleep(5)

        # assert the expected image has been downloaded
        os.path.exists(download_folder / "Brainstorm.png")

    def test_download_all_images(self, chrome_driver, download_folder):
        text_area = chrome_driver.find_element(By.ID, value="id_card_list")
        text_area.send_keys("4 brainstorm\n3 island\nhuntmaster of the fells")
        chrome_driver.find_element(By.ID, value="btn_submit").click()
        self.wait_for_search_results_modal(chrome_driver)

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

    def test_mobile_banner(self, mobile_chrome_driver):
        assert (
            "It seems like you're on a mobile device!"
            in mobile_chrome_driver.find_element(By.ID, "mobile-device-alert").text
        )

    # endregion
