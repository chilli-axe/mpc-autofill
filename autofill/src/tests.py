import os
import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from xml.etree import ElementTree

import pytest
from enlighten import Counter
from selenium.webdriver.common.by import By

import src.constants as constants
from src.driver import AutofillDriver
from src.order import CardImage, CardImageCollection, CardOrder, Details
from src.utils import get_google_drive_file_name, text_to_list

# region assert data structures identical


def assert_card_images_identical(a: CardImage, b: CardImage) -> None:
    assert (
        a.drive_id == b.drive_id
        and set(a.slots) == set(b.slots)
        and a.name == b.name
        and a.file_path == b.file_path
        and a.query == b.query
    )


def assert_card_image_collections_identical(a: CardImageCollection, b: CardImageCollection) -> None:
    assert a.face == b.face and a.num_slots == b.num_slots
    assert len(a.cards) == len(b.cards)
    for card_image_a, card_image_b in zip(
        sorted(a.cards, key=lambda x: x.drive_id),
        sorted(b.cards, key=lambda x: x.drive_id),
    ):
        assert_card_images_identical(card_image_a, card_image_b)


def assert_details_identical(a: Details, b: Details) -> None:
    assert a.quantity == b.quantity and a.bracket == b.bracket and a.stock == b.stock and a.foil == b.foil


def assert_orders_identical(a: CardOrder, b: CardOrder) -> None:
    assert_details_identical(a.details, b.details)
    assert_card_image_collections_identical(a.fronts, b.fronts)
    assert_card_image_collections_identical(a.backs, b.backs)


# endregion

# region fixtures


SIMPLE_CUBE = "Simple Cube"
SIMPLE_CUBE_ID = "1YKRRJUN8J9F4bAYCtZLb5mPDJDaabeR_"
SIMPLE_LOTUS = "Simple Lotus"
SIMPLE_LOTUS_ID = "1R7Wqjgghwe81mh0o83g_r3iC8zUaetKX"
TEST_IMAGE = "test_image"


@pytest.fixture()
def queue():
    yield Queue()


@pytest.fixture()
def counter():
    yield Counter()


@pytest.fixture()
def pool():
    yield ThreadPoolExecutor()


@pytest.fixture()
def input_enter(monkeypatch) -> None:
    monkeypatch.setattr("builtins.input", lambda _: "\n")


# @pytest.fixture()
# def std_in(monkeypatch) -> io.StringIO:
#     string_io = io.StringIO()
#     monkeypatch.setattr("sys.stdin", string_io)
#     return string_io


# region CardImage
@pytest.fixture()
def image_element_local_file() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(  # file exists in /src/cards
            f"""
            <card>
                <id>{os.getcwd()}/cards/{TEST_IMAGE}.png</id>
                <slots>0</slots>
                <name>{TEST_IMAGE}.png</name>
                <query>test image</query>
            </card>
            """
        )
    )


@pytest.fixture()
def image_local_file(image_element_local_file):
    card_image = CardImage.from_element(image_element_local_file)
    yield card_image


@pytest.fixture()
def image_element_invalid_google_drive() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <card>
                <id>invalid_google_drive_id</id>
                <slots>0</slots>
                <name>invalid_google_drive_image.png</name>
                <query>invalid google drive image</query>
            </card>
            """
        )
    )


@pytest.fixture()
def image_invalid_google_drive(image_element_invalid_google_drive) -> CardImage:
    card_image = CardImage.from_element(image_element_invalid_google_drive)
    yield card_image


@pytest.fixture()
def image_element_valid_google_drive() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <card>
                <id>{SIMPLE_CUBE_ID}</id>
                <slots>0</slots>
                <name>{SIMPLE_CUBE}.png</name>
                <query>simple cube</query>
            </card>
            """
        )
    )


@pytest.fixture()
def image_valid_google_drive(image_element_valid_google_drive) -> CardImage:
    card_image = CardImage.from_element(image_element_valid_google_drive)
    yield card_image


@pytest.fixture()
def image_element_valid_google_drive_on_disk() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(  # file exists in /src/cards
            f"""
            <card>
                <id>{SIMPLE_LOTUS_ID}</id>
                <slots>0</slots>
                <name>{SIMPLE_LOTUS}.png</name>
                <query>simple lotus</query>
            </card>
            """
        )
    )


@pytest.fixture()
def image_valid_google_drive_on_disk(
    image_element_valid_google_drive_on_disk,
) -> CardImage:
    card_image = CardImage.from_element(image_element_valid_google_drive_on_disk)
    yield card_image


@pytest.fixture()
def image_element_google_valid_drive_no_name() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
                <card>
                    <id>{SIMPLE_CUBE_ID}</id>
                    <slots>0</slots>
                    <name></name>
                    <query>simple cube</query>
                </card>
                """
        )
    )


@pytest.fixture()
def image_google_valid_drive_no_name(
    image_element_google_valid_drive_no_name,
) -> CardImage:
    card_image = CardImage.from_element(image_element_google_valid_drive_no_name)
    if os.path.exists(card_image.file_path):
        os.unlink(card_image.file_path)
    yield card_image
    if os.path.exists(card_image.file_path):
        os.unlink(card_image.file_path)  # image is downloaded from Google Drive in test


# endregion
# region CardImageCollection


@pytest.fixture()
def card_image_collection_element_valid() -> ElementTree:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <fronts>
                <card>
                    <id>{SIMPLE_CUBE_ID}</id>
                    <slots>0</slots>
                    <name>{SIMPLE_CUBE}.png</name>
                    <query>simple cube</query>
                </card>
                <card>
                    <id>{SIMPLE_LOTUS_ID}</id>
                    <slots>1,2</slots>
                    <name>{SIMPLE_LOTUS}.png</name>
                    <query>simple lotus</query>
                </card>
            </fronts>
            """
        )
    )


@pytest.fixture()
def card_image_collection_valid(
    card_image_collection_element_valid,
) -> CardImageCollection:
    card_image_collection = CardImageCollection.from_element(
        element=card_image_collection_element_valid,
        num_slots=1,
        face=constants.Faces.front,
    )
    yield card_image_collection


@pytest.fixture()
def card_image_collection_element_no_cards() -> ElementTree:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <fronts>
            </fronts>
            """
        )
    )


# endregion
# region Details


@pytest.fixture()
def details_element_valid() -> ElementTree:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <details>
                <quantity>1</quantity>
                <bracket>18</bracket>
                <stock>(S30) Standard Smooth</stock>
                <foil>false</foil>
            </details>
            """
        )
    )


@pytest.fixture()
def details_element_quantity_greater_than_bracket() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <details>
                <quantity>19</quantity>
                <bracket>18</bracket>
                <stock>(S30) Standard Smooth</stock>
                <foil>false</foil>
            </details>
            """
        )
    )


@pytest.fixture()
def details_element_invalid_cardstock() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <details>
                <quantity>18</quantity>
                <bracket>18</bracket>
                <stock>Invalid Cardstock</stock>
                <foil>false</foil>
            </details>
            """
        )
    )


@pytest.fixture()
def details_element_invalid_bracket() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <details>
                <quantity>18</quantity>
                <bracket>940</bracket>
                <stock>(S33) Superior Smooth</stock>
                <foil>false</foil>
            </details>
            """
        )
    )


# endregion
# region CardOrder


@pytest.fixture()
def card_order_element_valid() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <order>
                <details>
                    <quantity>3</quantity>
                    <bracket>18</bracket>
                    <stock>(S30) Standard Smooth</stock>
                    <foil>false</foil>
                </details>
                <fronts>
                    <card>
                        <id>{SIMPLE_CUBE_ID}</id>
                        <slots>0</slots>
                        <name>{SIMPLE_CUBE}.png</name>
                        <query>simple cube</query>
                    </card>
                    <card>
                        <id>{SIMPLE_LOTUS_ID}</id>
                        <slots>1,2</slots>
                        <name>{SIMPLE_LOTUS}.png</name>
                        <query>simple lotus</query>
                    </card>
                </fronts>
                <cardback>{os.getcwd()}/cards/{TEST_IMAGE}.png</cardback>
            </order>
            """
        )
    )


@pytest.fixture()
def card_order_valid(card_order_element_valid) -> CardOrder:
    yield CardOrder.from_element(card_order_element_valid)


@pytest.fixture()
def card_order_element_multiple_cardbacks() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <order>
                <details>
                    <quantity>4</quantity>
                    <bracket>18</bracket>
                    <stock>(M31) Linen</stock>
                    <foil>false</foil>
                </details>
                <fronts>
                    <card>
                        <id>{os.getcwd()}/cards/{TEST_IMAGE}.png</id>
                        <slots>0,3</slots>
                        <name></name>
                        <query></query>
                    </card>
                    <card>
                        <id>{SIMPLE_LOTUS_ID}</id>
                        <slots>1,2</slots>
                        <name>{SIMPLE_LOTUS}.png</name>
                        <query>simple lotus</query>
                    </card>
                </fronts>
                <backs>
                    <card>
                        <id>{SIMPLE_LOTUS_ID}</id>
                        <slots>1</slots>
                        <name>{SIMPLE_LOTUS}.png</name>
                        <query>simple lotus</query>
                    </card>
                </backs>
                <cardback>{SIMPLE_CUBE_ID}</cardback>
            </order>
            """
        )
    )


@pytest.fixture()
def card_order_multiple_cardbacks(card_order_element_multiple_cardbacks) -> CardOrder:
    yield CardOrder.from_element(card_order_element_multiple_cardbacks)


@pytest.fixture()
def card_order_element_invalid_quantity() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <order>
                <details>
                    <quantity>5</quantity>
                    <bracket>18</bracket>
                    <stock>(S33) Superior Smooth</stock>
                    <foil>true</foil>
                </details>
                <fronts>
                    <card>
                        <id>{SIMPLE_CUBE_ID}</id>
                        <slots>0</slots>
                        <name>{SIMPLE_CUBE}.png</name>
                        <query>simple cube</query>
                    </card>
                    <card>
                        <id>{SIMPLE_LOTUS_ID}</id>
                        <slots>1,2</slots>
                        <name>{SIMPLE_LOTUS}.png</name>
                        <query>simple lotus</query>
                    </card>
                </fronts>
                <cardback>{os.getcwd()}/cards/{TEST_IMAGE}.png</cardback>
            </order>
            """
        )
    )


@pytest.fixture()
def card_order_element_missing_front_image() -> ElementTree.Element:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <order>
                <details>
                    <quantity>4</quantity>
                    <bracket>18</bracket>
                    <stock>(S30) Standard Smooth</stock>
                    <foil>false</foil>
                </details>
                <fronts>
                    <card>
                        <id>{SIMPLE_CUBE_ID}</id>
                        <slots>0</slots>
                        <name>{SIMPLE_CUBE}.png</name>
                        <query>simple cube</query>
                    </card>
                    <card>
                        <id>{SIMPLE_LOTUS_ID}</id>
                        <slots>1,3</slots>
                        <name>{SIMPLE_LOTUS}.png</name>
                        <query>simple lotus</query>
                    </card>
                </fronts>
                <cardback>{os.getcwd()}/cards/{TEST_IMAGE}.png</cardback>
            </order>
            """
        )
    )


# endregion

# endregion

# region test utils.py


def test_get_google_drive_file_name():
    assert get_google_drive_file_name(SIMPLE_LOTUS_ID) == f"{SIMPLE_LOTUS}.png"
    assert get_google_drive_file_name(SIMPLE_CUBE_ID) == f"{SIMPLE_CUBE}.png"
    assert get_google_drive_file_name("invalid google drive ID") is None
    assert get_google_drive_file_name("") is None


def test_text_to_list():
    assert text_to_list("[1, 2, 3]") == [1, 2, 3]
    assert text_to_list("[1,2,3]") == [1, 2, 3]
    assert text_to_list("1, 2, 3") == [1, 2, 3]
    assert text_to_list("") == []


# endregion

# region test order.py
# region test CardImage


def test_card_image_drive_id_file_exists(image_local_file):
    assert image_local_file.drive_id == image_local_file.file_path
    assert image_local_file.file_exists()


def test_invalid_google_drive_image(image_invalid_google_drive, counter, queue):
    image_invalid_google_drive.download_image(download_bar=counter, queue=queue)
    assert image_invalid_google_drive.errored is True


def test_retrieve_card_name_and_download_file(image_google_valid_drive_no_name, counter, queue):
    assert image_google_valid_drive_no_name.name == f"{SIMPLE_CUBE}.png"
    assert not image_google_valid_drive_no_name.file_exists()
    image_google_valid_drive_no_name.download_image(download_bar=counter, queue=queue)
    assert image_google_valid_drive_no_name.file_exists()


def test_identify_existing_google_drive_image_file(image_valid_google_drive_on_disk):
    assert os.path.basename(image_valid_google_drive_on_disk.file_path) == image_valid_google_drive_on_disk.name
    assert image_valid_google_drive_on_disk.file_exists()


def test_generate_google_drive_file_path(image_valid_google_drive):
    assert os.path.basename(image_valid_google_drive.file_path) == f"{SIMPLE_CUBE} ({SIMPLE_CUBE_ID}).png"
    assert not image_valid_google_drive.file_exists()


# endregion

# region test CardImageCollection


def test_card_image_collection_download(card_image_collection_valid, counter, image_google_valid_drive_no_name, pool):
    assert card_image_collection_valid.slots() == {0, 1, 2}
    assert [x.file_exists() for x in card_image_collection_valid.cards] == [False, True]
    card_image_collection_valid.download_images(pool=pool, download_bar=counter)
    time.sleep(3)
    pool.shutdown(wait=True, cancel_futures=False)
    assert all([x.file_exists() for x in card_image_collection_valid.cards])


def test_card_image_collection_no_cards(input_enter, card_image_collection_element_no_cards):
    with pytest.raises(SystemExit) as exc_info:
        CardImageCollection.from_element(
            card_image_collection_element_no_cards, face=constants.Faces.front, num_slots=3
        )
    assert exc_info.value.code == 0


# endregion

# region test Details


def test_details_valid(details_element_valid):
    details = Details.from_element(details_element_valid)
    assert_details_identical(
        details,
        Details(quantity=1, bracket=18, stock=constants.Cardstocks.S30, foil=False),
    )


def test_details_quantity_greater_than_bracket(input_enter, details_element_quantity_greater_than_bracket):
    with pytest.raises(SystemExit) as exc_info:
        Details.from_element(details_element_quantity_greater_than_bracket)
    assert exc_info.value.code == 0


def test_details_invalid_cardstock(input_enter, details_element_invalid_cardstock):
    with pytest.raises(SystemExit) as exc_info:
        Details.from_element(details_element_invalid_cardstock)
    assert exc_info.value.code == 0


def test_details_invalid_bracket(input_enter, details_element_invalid_bracket):
    with pytest.raises(SystemExit) as exc_info:
        Details.from_element(details_element_invalid_bracket)
    assert exc_info.value.code == 0


# endregion

# region test CardOrder


def test_card_order_valid(card_order_valid):
    assert_orders_identical(
        card_order_valid,
        CardOrder(
            details=Details(
                quantity=3,
                bracket=18,
                stock=constants.Cardstocks.S30,
                foil=False,
            ),
            fronts=CardImageCollection(
                face=constants.Faces.front,
                num_slots=3,
                cards=[
                    CardImage(
                        drive_id=SIMPLE_CUBE_ID,
                        slots=[0],
                        name=f"{SIMPLE_CUBE}.png",
                        file_path=f"{os.getcwd()}/cards/{SIMPLE_CUBE} ({SIMPLE_CUBE_ID}).png",  # not on disk
                        query="simple cube",
                    ),
                    CardImage(
                        drive_id=SIMPLE_LOTUS_ID,
                        slots=[1, 2],
                        name=f"{SIMPLE_LOTUS}.png",
                        file_path=f"{os.getcwd()}/cards/{SIMPLE_LOTUS}.png",  # already exists on disk
                        query="simple lotus",
                    ),
                ],
            ),
            backs=CardImageCollection(
                face=constants.Faces.back,
                num_slots=3,
                cards=[
                    CardImage(
                        drive_id=f"{os.getcwd()}/cards/{TEST_IMAGE}.png",
                        slots=[0],  # for orders with a single back image, the back image is only assigned to slot 0
                        name=f"{TEST_IMAGE}.png",  # name retrieved from file on disk
                        file_path=f"{os.getcwd()}/cards/{TEST_IMAGE}.png",
                        query=None,
                    )
                ],
            ),
        ),
    )


def test_card_order_multiple_cardbacks(card_order_multiple_cardbacks):
    assert_orders_identical(
        card_order_multiple_cardbacks,
        CardOrder(
            details=Details(
                quantity=4,
                bracket=18,
                stock=constants.Cardstocks.M31,
                foil=False,
            ),
            fronts=CardImageCollection(
                face=constants.Faces.front,
                num_slots=4,
                cards=[
                    CardImage(
                        drive_id=f"{os.getcwd()}/cards/{TEST_IMAGE}.png",
                        slots=[0, 3],
                        name=f"{TEST_IMAGE}.png",  # name retrieved from file on disk
                        file_path=f"{os.getcwd()}/cards/{TEST_IMAGE}.png",
                        query=None,
                    ),
                    CardImage(
                        drive_id=SIMPLE_LOTUS_ID,
                        slots=[1, 2],
                        name=f"{SIMPLE_LOTUS}.png",
                        file_path=f"{os.getcwd()}/cards/{SIMPLE_LOTUS}.png",  # already exists on disk
                        query="simple lotus",
                    ),
                ],
            ),
            backs=CardImageCollection(
                face=constants.Faces.back,
                num_slots=4,
                cards=[
                    CardImage(
                        drive_id=SIMPLE_LOTUS_ID,
                        slots=[1],
                        name=f"{SIMPLE_LOTUS}.png",
                        file_path=f"{os.getcwd()}/cards/{SIMPLE_LOTUS}.png",  # already exists on disk
                        query="simple lotus",
                    ),
                    CardImage(
                        drive_id=SIMPLE_CUBE_ID,
                        slots=[0, 2, 3],
                        name=f"{SIMPLE_CUBE}.png",
                        file_path=f"{os.getcwd()}/cards/{SIMPLE_CUBE} ({SIMPLE_CUBE_ID}).png",  # not on disk
                        query=None,
                    ),
                ],
            ),
        ),
    )


def test_card_order_valid_from_file():
    card_order = CardOrder.from_file_name("test_order.xml")
    for card in [*card_order.fronts.cards, *card_order.backs.cards]:
        assert not card.file_exists()
    assert_orders_identical(
        card_order,
        CardOrder(
            details=Details(
                quantity=10,
                bracket=18,
                stock=constants.Cardstocks.S30,
                foil=True,
            ),
            fronts=CardImageCollection(
                face=constants.Faces.front,
                num_slots=10,
                cards=[
                    CardImage(
                        drive_id="1OAw4l9RYbgYrmnyYeR1iVDoIS6_aus49",
                        slots=list(range(9)),
                        name="Island (Unsanctioned).png",
                        file_path=f"{os.getcwd()}/cards/Island (Unsanctioned).png",
                        query="island",
                    ),
                    CardImage(
                        drive_id="1wlrM7pNHQ5NqS9GY5LWH7Hd04TtNgHI4",
                        slots=[9],
                        name="Rite of Flame.png",
                        file_path=f"{os.getcwd()}/cards/Rite of Flame.png",
                        query="rite of flame",
                    ),
                ],
            ),
            backs=CardImageCollection(
                face=constants.Faces.back,
                num_slots=10,
                cards=[
                    CardImage(
                        drive_id="16g2UamJ2jzwNHovLesvsinvd6_qPkZfy",
                        slots=[0],  # for orders with a single back image, the back image is only assigned to slot 0
                        name="MTGA Lotus.png",
                        file_path=f"{os.getcwd()}/cards/MTGA Lotus.png",
                        query=None,
                    )
                ],
            ),
        ),
    )


def test_card_order_mangled_xml(input_enter):
    with pytest.raises(SystemExit) as exc_info:
        CardOrder.from_file_name("mangled.xml")  # file is missing closing ">" at end
    assert exc_info.value.code == 0


# endregion
# endregion

# region test driver.py


def test_card_order_complete_run_single_cardback(input_enter, card_order_valid):
    autofill_driver = AutofillDriver(order=card_order_valid, headless=True)
    autofill_driver.execute(skip_setup=False)
    time.sleep(5)  # seems necessary to ensure these tests work as expected on ci/cd
    assert len(autofill_driver.driver.find_elements(by=By.CLASS_NAME, value="m-itemside")) == 3


def test_card_order_complete_run_multiple_cardbacks(input_enter, card_order_multiple_cardbacks):
    autofill_driver = AutofillDriver(order=card_order_multiple_cardbacks, headless=True)
    autofill_driver.execute(skip_setup=False)
    time.sleep(5)  # seems necessary to ensure these tests work as expected on ci/cd
    assert len(autofill_driver.driver.find_elements(by=By.CLASS_NAME, value="m-itemside")) == 4


def test_card_order_invalid_quantity(input_enter, card_order_element_invalid_quantity):
    with pytest.raises(SystemExit) as exc_info:
        CardOrder.from_element(card_order_element_invalid_quantity)
    assert exc_info.value.code == 0


# endregion
