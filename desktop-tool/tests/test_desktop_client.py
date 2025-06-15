import io as std_io
import logging
import os
import textwrap
import time
import unittest.mock as mock
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from io import BytesIO
from itertools import groupby
from queue import Queue
from typing import Callable, Generator
from xml.etree import ElementTree

import pytest
import requests
from enlighten import Counter
from PIL import Image, ImageOps
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

import src.constants as constants
import src.utils
from src import io
from src.driver import AutofillDriver
from src.io import (
    download_image_from_url,
    get_google_drive_file_name,
    remove_directories,
    remove_files,
)
from src.order import (
    CardImage,
    CardImageCollection,
    CardOrder,
    Details,
    aggregate_and_split_orders,
)
from src.pdf_maker import PdfExporter
from src.processing import (
    ImagePostProcessingConfig,
    _add_black_border,
    post_process_image,
)
from src.utils import text_to_set

DEFAULT_POST_PROCESSING = ImagePostProcessingConfig(max_dpi=800, downscale_alg=constants.ImageResizeMethods.LANCZOS)


# region assert data structures identical


def assert_card_images_identical(a: CardImage, b: CardImage) -> None:
    assert a.drive_id == b.drive_id, f"Drive ID {a.drive_id} does not match {b.drive_id}"
    assert set(a.slots) == set(b.slots), f"Slots {sorted(a.slots)} do not match {sorted(b.slots)}"
    assert a.name == b.name, f"Name {a.name} does not match {b.name}"
    assert a.file_path == b.file_path, f"File path {a.file_path} does not match {b.file_path}"
    assert a.query == b.query, f"Query {a.query} does not match {b.query}"


def assert_card_image_collections_identical(a: CardImageCollection, b: CardImageCollection) -> None:
    assert a.face == b.face, f"Face {a.face} does not match {b.face}"
    assert a.num_slots == b.num_slots, f"Number of slots {a.num_slots} do not match {b.num_slots}"
    assert len(a.cards_by_id) == len(
        b.cards_by_id
    ), f"Number of cards {len(a.cards_by_id)} do not match {len(b.cards_by_id)}"
    for card_image_id_a, card_image_id_b in zip(sorted(a.cards_by_id.keys()), sorted(b.cards_by_id.keys())):
        assert_card_images_identical(a.cards_by_id[card_image_id_a], b.cards_by_id[card_image_id_b])


def assert_details_identical(a: Details, b: Details) -> None:
    assert a.quantity == b.quantity, f"Quantity {a.quantity} does not match {b.quantity}"
    assert a.stock == b.stock, f"Stock {a.stock} does not match {b.stock}"
    assert a.foil == b.foil, f"Foil {a.foil} does not match {b.foil}"


def assert_orders_identical(a: CardOrder, b: CardOrder) -> None:
    assert_details_identical(a.details, b.details), "Details do not match"
    assert_card_image_collections_identical(a.fronts, b.fronts), "Fronts do not match"
    assert_card_image_collections_identical(a.backs, b.backs), "Backs do not match"


def assert_file_size(file_path: str, size: int) -> None:
    assert os.stat(file_path).st_size == size, f"File size {os.stat(file_path).st_size} does not match {size}"


# endregion

# region constants

FILE_PATH = os.path.abspath(os.path.dirname(__file__))
CARDS_FILE_PATH = os.path.join(FILE_PATH, "cards")
SIMPLE_CUBE = "Simple Cube"
SIMPLE_CUBE_ID = "1JtXL6Ca9nQkvhwZZRR9ZuKA9_DzsFf1V"
SIMPLE_LOTUS = "Simple Lotus"
SIMPLE_LOTUS_ID = "1oigI6wz0zA--pNMuExKTs40kBNH6VRP_"
TEST_IMAGE = "test_image"

# endregion

# region fixtures


@pytest.fixture(autouse=True)
def monkeypatch_current_working_directory(request, monkeypatch) -> None:
    monkeypatch.setattr(os, "getcwd", lambda: FILE_PATH)
    monkeypatch.setattr(src.io, "CURRDIR", FILE_PATH)
    monkeypatch.chdir(FILE_PATH)


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
def input_enter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("builtins.input", lambda _: "\n")


# region CardImage
@pytest.fixture()
def image_element_local_file() -> Generator[ElementTree.Element, None, None]:
    yield ElementTree.fromstring(
        textwrap.dedent(  # file exists in /src/cards
            f"""
            <card>
                <id>{os.path.join(CARDS_FILE_PATH, TEST_IMAGE)}.png</id>
                <slots>0</slots>
                <name>{TEST_IMAGE}.png</name>
                <query>test image</query>
            </card>
            """
        )
    )


@pytest.fixture()
def image_local_file(image_element_local_file: ElementTree.Element) -> Generator[CardImage, None, None]:
    card_image = CardImage.from_element(image_element_local_file)
    yield card_image


@pytest.fixture()
def image_element_invalid_google_drive() -> Generator[ElementTree.Element, None, None]:
    yield ElementTree.fromstring(
        textwrap.dedent(
            """
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
def image_invalid_google_drive(
    image_element_invalid_google_drive: ElementTree.Element,
) -> Generator[CardImage, None, None]:
    card_image = CardImage.from_element(image_element_invalid_google_drive)
    yield card_image


@pytest.fixture()
def image_element_valid_google_drive() -> Generator[ElementTree.Element, None, None]:
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
def image_valid_google_drive(image_element_valid_google_drive: ElementTree.Element) -> Generator[CardImage, None, None]:
    card_image = CardImage.from_element(image_element_valid_google_drive)
    if card_image.file_path is not None and os.path.exists(card_image.file_path):
        os.unlink(card_image.file_path)
    yield card_image
    if card_image.file_path is not None and os.path.exists(card_image.file_path):
        os.unlink(card_image.file_path)  # image is downloaded from Google Drive in test


@pytest.fixture()
def image_element_valid_google_drive_on_disk() -> Generator[ElementTree.Element, None, None]:
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
    image_element_valid_google_drive_on_disk: ElementTree.Element,
) -> Generator[CardImage, None, None]:
    card_image = CardImage.from_element(image_element_valid_google_drive_on_disk)
    yield card_image


@pytest.fixture()
def image_element_google_valid_drive_no_name() -> Generator[ElementTree.Element, None, None]:
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
    image_element_google_valid_drive_no_name: ElementTree.Element,
) -> Generator[CardImage, None, None]:
    card_image = CardImage.from_element(image_element_google_valid_drive_no_name)
    if card_image.file_path is not None and os.path.exists(card_image.file_path):
        os.unlink(card_image.file_path)
    yield card_image
    if card_image.file_path is not None and os.path.exists(card_image.file_path):
        os.unlink(card_image.file_path)  # image is downloaded from Google Drive in test


# endregion
# region CardImageCollection


@pytest.fixture()
def card_image_collection_element_valid():
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
    card_image_collection_element_valid: ElementTree.Element,
) -> Generator[CardImageCollection, None, None]:
    card_image_collection = CardImageCollection.from_element(
        element=card_image_collection_element_valid,
        num_slots=1,
        face=constants.Faces.front,
    )
    yield card_image_collection


@pytest.fixture()
def card_image_collection_element_no_cards():
    yield ElementTree.fromstring(
        textwrap.dedent(
            """
            <fronts>
            </fronts>
            """
        )
    )


# endregion
# region Details


@pytest.fixture()
def details_element_valid():
    yield ElementTree.fromstring(
        textwrap.dedent(
            """
            <details>
                <quantity>1</quantity>
                <stock>(S30) Standard Smooth</stock>
                <foil>false</foil>
            </details>
            """
        )
    )


@pytest.fixture()
def details_element_quantity_greater_than_max_size() -> Generator[ElementTree.Element, None, None]:
    yield ElementTree.fromstring(
        textwrap.dedent(
            """
            <details>
                <quantity>1900</quantity>
                <stock>(S30) Standard Smooth</stock>
                <foil>false</foil>
            </details>
            """
        )
    )


@pytest.fixture()
def details_element_invalid_cardstock() -> Generator[ElementTree.Element, None, None]:
    yield ElementTree.fromstring(
        textwrap.dedent(
            """
            <details>
                <quantity>18</quantity>
                <stock>Invalid Cardstock</stock>
                <foil>false</foil>
            </details>
            """
        )
    )


# endregion
# region CardOrder


@pytest.fixture()
def card_order_element_valid() -> Generator[ElementTree.Element, None, None]:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <order>
                <details>
                    <quantity>3</quantity>
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
                <cardback>{os.path.join(CARDS_FILE_PATH, TEST_IMAGE)}.png</cardback>
            </order>
            """
        )
    )


@pytest.fixture()
def card_order_valid(card_order_element_valid: ElementTree.Element) -> Generator[CardOrder, None, None]:
    yield CardOrder.from_element(card_order_element_valid, allowed_to_exceed_project_max_size=False)


@pytest.fixture()
def card_order_element_multiple_cardbacks() -> Generator[ElementTree.Element, None, None]:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <order>
                <details>
                    <quantity>4</quantity>
                    <stock>(M31) Linen</stock>
                    <foil>false</foil>
                </details>
                <fronts>
                    <card>
                        <id>{os.path.join(CARDS_FILE_PATH, TEST_IMAGE)}.png</id>
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
def card_order_multiple_cardbacks(
    card_order_element_multiple_cardbacks: ElementTree.Element,
) -> Generator[CardOrder, None, None]:
    yield CardOrder.from_element(card_order_element_multiple_cardbacks, allowed_to_exceed_project_max_size=False)


@pytest.fixture()
def card_order_element_invalid_quantity() -> Generator[ElementTree.Element, None, None]:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <order>
                <details>
                    <quantity>5</quantity>
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
                <cardback>{os.path.join(CARDS_FILE_PATH, TEST_IMAGE)}.png</cardback>
            </order>
            """
        )
    )


@pytest.fixture()
def card_order_element_missing_front_image() -> Generator[ElementTree.Element, None, None]:
    yield ElementTree.fromstring(
        textwrap.dedent(
            f"""
            <order>
                <details>
                    <quantity>4</quantity>
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
                <cardback>{os.path.join(CARDS_FILE_PATH, TEST_IMAGE)}.png</cardback>
            </order>
            """
        )
    )


# endregion

# endregion

# region test processing.py


def test_post_process_image_with_no_dpi():
    """
    Tests that post_process_image returns the image unchanged when the
    config is provided but max_dpi is None. This covers the final
    untested branch in the function.
    """
    # Create a dummy image that is larger than any potential DPI
    img = Image.new("RGB", (1000, 1200), color="red")

    byte_arr = std_io.BytesIO()
    img.save(byte_arr, format="PNG")
    raw_image = byte_arr.getvalue()

    # Create a config with max_dpi set to None
    config = ImagePostProcessingConfig(max_dpi=None, downscale_alg=constants.ImageResizeMethods.LANCZOS)

    # Process the image
    processed_img = post_process_image(raw_image, config)

    # The image should be identical to the original
    assert img.mode == processed_img.mode
    assert img.size == processed_img.size
    assert img.tobytes() == processed_img.tobytes()


def test_add_black_border():
    """Tests the _add_black_border function."""
    original_size = (100, 150)
    border_size = 10
    img = Image.new("RGB", original_size, color="blue")

    bordered_img = _add_black_border(img, border_size)

    expected_size = (original_size[0] + 2 * border_size, original_size[1] + 2 * border_size)
    assert bordered_img.size == expected_size, "Bordered image has incorrect dimensions."

    assert bordered_img.getpixel((0, 0)) == (0, 0, 0), "Top-left border pixel is not black."


# endregion

# region test utils.py


def test_get_google_drive_file_name():
    assert get_google_drive_file_name(SIMPLE_LOTUS_ID) == f"{SIMPLE_LOTUS}.png"
    assert get_google_drive_file_name(SIMPLE_CUBE_ID) == f"{SIMPLE_CUBE}.png"
    assert get_google_drive_file_name("invalid google drive ID") is None
    assert get_google_drive_file_name("") is None


def test_text_to_set():
    assert text_to_set("[1, 2, 3]") == {1, 2, 3}
    assert text_to_set("[1,2,3]") == {1, 2, 3}
    assert text_to_set("1, 2, 3") == {1, 2, 3}
    assert text_to_set("") == set()


# endregion

# region test CardImage


def test_card_image_drive_id_file_exists(image_local_file: CardImage):
    assert image_local_file.drive_id == image_local_file.file_path
    assert image_local_file.file_exists()


def test_download_google_drive_image_default_post_processing(
    image_valid_google_drive: CardImage, counter: Counter, queue: Queue[CardImage]
):
    image_valid_google_drive.download_image(
        download_bar=counter, queue=queue, post_processing_config=DEFAULT_POST_PROCESSING
    )
    assert image_valid_google_drive.file_exists() is True
    assert image_valid_google_drive.errored is False
    assert_file_size(image_valid_google_drive.file_path, 152990)


def test_download_google_drive_image_downscaled(
    image_valid_google_drive: CardImage, counter: Counter, queue: Queue[CardImage]
):
    image_valid_google_drive.download_image(
        download_bar=counter,
        queue=queue,
        post_processing_config=ImagePostProcessingConfig(
            max_dpi=100, downscale_alg=constants.ImageResizeMethods.LANCZOS
        ),
    )
    assert image_valid_google_drive.file_exists() is True
    assert image_valid_google_drive.errored is False
    assert_file_size(image_valid_google_drive.file_path, 51123)


def test_download_google_drive_image_no_post_processing(
    image_valid_google_drive: CardImage, counter: Counter, queue: Queue[CardImage]
):
    image_valid_google_drive.download_image(download_bar=counter, queue=queue, post_processing_config=None)
    assert image_valid_google_drive.file_exists() is True
    assert image_valid_google_drive.errored is False
    assert_file_size(image_valid_google_drive.file_path, 155686)


def test_invalid_google_drive_image(image_invalid_google_drive: CardImage, counter: Counter, queue: Queue[CardImage]):
    image_invalid_google_drive.download_image(
        download_bar=counter, queue=queue, post_processing_config=DEFAULT_POST_PROCESSING
    )
    assert image_invalid_google_drive.errored is True


def test_retrieve_card_name_and_download_file(image_google_valid_drive_no_name, counter, queue):
    assert image_google_valid_drive_no_name.name == f"{SIMPLE_CUBE}.png"
    assert not image_google_valid_drive_no_name.file_exists()
    image_google_valid_drive_no_name.download_image(
        download_bar=counter, queue=queue, post_processing_config=DEFAULT_POST_PROCESSING
    )
    assert image_google_valid_drive_no_name.file_exists()


def test_identify_existing_google_drive_image_file(image_valid_google_drive_on_disk):
    assert os.path.basename(image_valid_google_drive_on_disk.file_path) == image_valid_google_drive_on_disk.name
    assert image_valid_google_drive_on_disk.file_exists()


def test_generate_google_drive_file_path(image_valid_google_drive):
    assert os.path.basename(image_valid_google_drive.file_path) == f"{SIMPLE_CUBE} ({SIMPLE_CUBE_ID}).png"
    assert not image_valid_google_drive.file_exists()


@pytest.mark.parametrize(
    "image_a, image_b, expected_result",
    [
        (
            CardImage(drive_id="1", name="a.jpg", file_path=os.path.join(CARDS_FILE_PATH, "a (1).jpg"), slots={1, 2}),
            CardImage(drive_id="1", name="a.jpg", file_path=os.path.join(CARDS_FILE_PATH, "a (1).jpg"), slots={2, 3}),
            CardImage(
                drive_id="1", name="a.jpg", file_path=os.path.join(CARDS_FILE_PATH, "a (1).jpg"), slots={1, 2, 3}
            ),
        )
    ],
)
def test_combine_images(image_a, image_b, expected_result):
    assert_card_images_identical(image_a.combine(image_b), expected_result)


def test_card_image_split_no_splits():
    """Tests CardImage.split when an empty list is provided."""
    card = CardImage(drive_id="1", slots={0, 1, 2})
    result = card.split([])
    assert len(result) == 1
    assert result[0] is card


def test_card_image_generate_filepath_no_name(monkeypatch):
    """Tests the filepath generation when name is initially None from GDrive."""

    def mock_get_name(drive_id):
        return None

    monkeypatch.setattr("src.order.get_google_drive_file_name", mock_get_name)
    card = CardImage(drive_id="test_id_123")
    assert card.name == "test_id_123.png"
    assert card.errored is False


# endregion

# region test CardImageCollection


def test_card_image_collection_download(card_image_collection_valid, counter, image_google_valid_drive_no_name, pool):
    assert card_image_collection_valid.slots() == {0, 1, 2}
    assert [x.file_exists() for x in card_image_collection_valid.cards_by_id.values()] == [False, True]
    card_image_collection_valid.download_images(
        pool=pool, download_bar=counter, post_processing_config=DEFAULT_POST_PROCESSING
    )
    time.sleep(3)
    pool.shutdown(wait=True, cancel_futures=False)
    assert all([x.file_exists() for x in card_image_collection_valid.cards_by_id.values()])


def test_card_image_collection_no_cards(input_enter, card_image_collection_element_no_cards):
    with pytest.raises(SystemExit) as exc_info:
        CardImageCollection.from_element(
            card_image_collection_element_no_cards, face=constants.Faces.front, num_slots=3
        )
    assert exc_info.value.code == 0


def test_card_image_collection_append_duplicate_id():
    """Tests appending a card with a drive_id that already exists."""
    collection = CardImageCollection(num_slots=4)
    card1 = CardImage(drive_id="1", slots={0, 1})
    card2 = CardImage(drive_id="1", slots={2})
    collection.append(card1)
    collection.append(card2)
    assert len(collection.cards_by_id) == 1
    assert collection.cards_by_id["1"].slots == {0, 1, 2}


# endregion

# region test Details


def test_details_valid(details_element_valid):
    details = Details.from_element(details_element_valid, allowed_to_exceed_project_max_size=False)
    assert_details_identical(
        details,
        Details(quantity=1, stock=constants.Cardstocks.S30.value, foil=False),
    )


def test_details_quantity_greater_than_max_size(input_enter, details_element_quantity_greater_than_max_size):
    with pytest.raises(SystemExit) as exc_info:
        Details.from_element(details_element_quantity_greater_than_max_size, allowed_to_exceed_project_max_size=False)
    assert exc_info.value.code == 0


def test_details_invalid_cardstock(input_enter, details_element_invalid_cardstock):
    with pytest.raises(SystemExit) as exc_info:
        Details.from_element(details_element_invalid_cardstock, allowed_to_exceed_project_max_size=False)
    assert exc_info.value.code == 0


# endregion

# region test CardOrder


def test_card_order_valid(card_order_valid):
    assert_orders_identical(
        card_order_valid,
        CardOrder(
            details=Details(
                quantity=3,
                stock=constants.Cardstocks.S30.value,
                foil=False,
            ),
            fronts=CardImageCollection(
                face=constants.Faces.front,
                num_slots=3,
                cards_by_id={
                    SIMPLE_CUBE_ID: CardImage(
                        drive_id=SIMPLE_CUBE_ID,
                        slots={0},
                        name=f"{SIMPLE_CUBE}.png",
                        file_path=os.path.join(CARDS_FILE_PATH, f"{SIMPLE_CUBE} ({SIMPLE_CUBE_ID}).png"),  # not on disk
                        query="simple cube",
                    ),
                    SIMPLE_LOTUS_ID: CardImage(
                        drive_id=SIMPLE_LOTUS_ID,
                        slots={1, 2},
                        name=f"{SIMPLE_LOTUS}.png",
                        file_path=os.path.join(CARDS_FILE_PATH, f"{SIMPLE_LOTUS}.png"),  # already exists on disk
                        query="simple lotus",
                    ),
                },
            ),
            backs=CardImageCollection(
                face=constants.Faces.back,
                num_slots=3,
                cards_by_id={
                    os.path.join(CARDS_FILE_PATH, f"{TEST_IMAGE}.png"): CardImage(
                        drive_id=os.path.join(CARDS_FILE_PATH, f"{TEST_IMAGE}.png"),
                        slots={0, 1, 2},
                        name=f"{TEST_IMAGE}.png",  # name retrieved from file on disk
                        file_path=os.path.join(CARDS_FILE_PATH, f"{TEST_IMAGE}.png"),
                        query=None,
                    )
                },
            ),
        ),
    )


def test_card_order_multiple_cardbacks(card_order_multiple_cardbacks):
    assert_orders_identical(
        card_order_multiple_cardbacks,
        CardOrder(
            details=Details(
                quantity=4,
                stock=constants.Cardstocks.M31.value,
                foil=False,
            ),
            fronts=CardImageCollection(
                face=constants.Faces.front,
                num_slots=4,
                cards_by_id={
                    os.path.join(CARDS_FILE_PATH, "{TEST_IMAGE}.png"): CardImage(
                        drive_id=os.path.join(CARDS_FILE_PATH, f"{TEST_IMAGE}.png"),
                        slots={0, 3},
                        name=f"{TEST_IMAGE}.png",  # name retrieved from file on disk
                        file_path=os.path.join(CARDS_FILE_PATH, f"{TEST_IMAGE}.png"),
                        query=None,
                    ),
                    SIMPLE_LOTUS_ID: CardImage(
                        drive_id=SIMPLE_LOTUS_ID,
                        slots={1, 2},
                        name=f"{SIMPLE_LOTUS}.png",
                        file_path=os.path.join(CARDS_FILE_PATH, f"{SIMPLE_LOTUS}.png"),  # already exists on disk
                        query="simple lotus",
                    ),
                },
            ),
            backs=CardImageCollection(
                face=constants.Faces.back,
                num_slots=4,
                cards_by_id={
                    SIMPLE_LOTUS_ID: CardImage(
                        drive_id=SIMPLE_LOTUS_ID,
                        slots={1},
                        name=f"{SIMPLE_LOTUS}.png",
                        file_path=os.path.join(CARDS_FILE_PATH, f"{SIMPLE_LOTUS}.png"),  # already exists on disk
                        query="simple lotus",
                    ),
                    SIMPLE_CUBE_ID: CardImage(
                        drive_id=SIMPLE_CUBE_ID,
                        slots={0, 2, 3},
                        name=f"{SIMPLE_CUBE}.png",
                        file_path=os.path.join(CARDS_FILE_PATH, f"{SIMPLE_CUBE} ({SIMPLE_CUBE_ID}).png"),  # not on disk
                        query=None,
                    ),
                },
            ),
        ),
    )


def test_card_order_valid_from_file():
    card_order = CardOrder.from_file_path("test_order.xml")
    for card in (card_order.fronts.cards_by_id | card_order.backs.cards_by_id).values():
        assert not card.file_exists()
    assert_orders_identical(
        card_order,
        CardOrder(
            details=Details(
                quantity=10,
                stock=constants.Cardstocks.S30.value,
                foil=True,
            ),
            fronts=CardImageCollection(
                face=constants.Faces.front,
                num_slots=10,
                cards_by_id={
                    "1OAw4l9RYbgYrmnyYeR1iVDoIS6_aus49": CardImage(
                        drive_id="1OAw4l9RYbgYrmnyYeR1iVDoIS6_aus49",
                        slots=set(range(9)),
                        name="Island (Unsanctioned).png",
                        file_path=os.path.join(
                            CARDS_FILE_PATH, "Island (Unsanctioned) (1OAw4l9RYbgYrmnyYeR1iVDoIS6_aus49).png"
                        ),
                        query="island",
                    ),
                    "1wlrM7pNHQ5NqS9GY5LWH7Hd04TtNgHI4": CardImage(
                        drive_id="1wlrM7pNHQ5NqS9GY5LWH7Hd04TtNgHI4",
                        slots={9},
                        name="Rite of Flame.png",
                        file_path=os.path.join(
                            CARDS_FILE_PATH, "Rite of Flame (1wlrM7pNHQ5NqS9GY5LWH7Hd04TtNgHI4).png"
                        ),
                        query="rite of flame",
                    ),
                },
            ),
            backs=CardImageCollection(
                face=constants.Faces.back,
                num_slots=10,
                cards_by_id={
                    "16g2UamJ2jzwNHovLesvsinvd6_qPkZfy": CardImage(
                        drive_id="16g2UamJ2jzwNHovLesvsinvd6_qPkZfy",
                        slots=set(range(10)),
                        name="MTGA Lotus.png",
                        file_path=os.path.join(CARDS_FILE_PATH, "MTGA Lotus (16g2UamJ2jzwNHovLesvsinvd6_qPkZfy).png"),
                        query=None,
                    )
                },
            ),
        ),
    )


def test_card_order_mangled_xml(input_enter):
    with pytest.raises(SystemExit) as exc_info:
        CardOrder.from_file_path("mangled.xml")  # file is missing closing ">" at end
    assert exc_info.value.code == 0


def test_card_order_missing_slots(input_enter, card_order_element_invalid_quantity):
    # just testing that this order parses without error
    CardOrder.from_element(card_order_element_invalid_quantity, allowed_to_exceed_project_max_size=False)


@pytest.mark.parametrize(
    "input_orders, expected_order",
    [
        # region two small orders which share the same singleton cardback
        (
            # input orders
            [
                CardOrder(
                    details=Details(quantity=2, stock=constants.Cardstocks.S30.value, foil=False),
                    fronts=CardImageCollection(
                        cards_by_id={
                            "1": CardImage(
                                drive_id="1",
                                name="1.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                                slots={0, 1},
                            )
                        },
                        num_slots=2,
                        face=constants.Faces.front,
                    ),
                    backs=CardImageCollection(
                        cards_by_id={
                            "2": CardImage(
                                drive_id="2",
                                name="2.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                                slots={0, 1},
                            )
                        },
                        num_slots=2,
                        face=constants.Faces.back,
                    ),
                ),
                CardOrder(
                    details=Details(quantity=2, stock=constants.Cardstocks.S30.value, foil=False),
                    fronts=CardImageCollection(
                        cards_by_id={
                            "3": CardImage(
                                drive_id="3",
                                name="3.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "3 (3).png"),
                                slots={0},
                            ),
                            "4": CardImage(
                                drive_id="4",
                                name="4.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "4 (4).png"),
                                slots={1},
                            ),
                        },
                        num_slots=2,
                        face=constants.Faces.front,
                    ),
                    backs=CardImageCollection(
                        cards_by_id={
                            "2": CardImage(
                                drive_id="2",
                                name="2.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                                slots={0, 1},
                            )
                        },
                        num_slots=2,
                        face=constants.Faces.back,
                    ),
                ),
            ],
            # expected order
            CardOrder(
                details=Details(quantity=4, stock=constants.Cardstocks.S30.value, foil=False),
                fronts=CardImageCollection(
                    cards_by_id={
                        "1": CardImage(
                            drive_id="1",
                            name="1.png",
                            file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                            slots={0, 1},
                        ),
                        "3": CardImage(
                            drive_id="3", name="3.png", file_path=os.path.join(CARDS_FILE_PATH, "3 (3).png"), slots={2}
                        ),
                        "4": CardImage(
                            drive_id="4", name="4.png", file_path=os.path.join(CARDS_FILE_PATH, "4 (4).png"), slots={3}
                        ),
                    },
                    num_slots=4,
                    face=constants.Faces.front,
                ),
                backs=CardImageCollection(
                    # the slots for `2` across both orders will be merged as below
                    cards_by_id={
                        "2": CardImage(
                            drive_id="2",
                            name="2.png",
                            file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                            slots={0, 1, 2, 3},
                        )
                    },
                    num_slots=4,
                    face=constants.Faces.back,
                ),
            ),
        ),
        # endregion
        # region two small orders which do not share the same singleton cardback
        (
            # input orders
            [
                CardOrder(
                    details=Details(quantity=2, stock=constants.Cardstocks.S30.value, foil=False),
                    fronts=CardImageCollection(
                        cards_by_id={
                            "1": CardImage(
                                drive_id="1",
                                name="1.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                                slots={0, 1},
                            )
                        },
                        num_slots=2,
                        face=constants.Faces.front,
                    ),
                    backs=CardImageCollection(
                        cards_by_id={
                            "2": CardImage(
                                drive_id="2",
                                name="2.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                                slots={0, 1},
                            )
                        },
                        num_slots=2,
                        face=constants.Faces.back,
                    ),
                ),
                CardOrder(
                    details=Details(quantity=2, stock=constants.Cardstocks.S30.value, foil=False),
                    fronts=CardImageCollection(
                        cards_by_id={
                            "3": CardImage(
                                drive_id="3",
                                name="3.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "3 (3).png"),
                                slots={0},
                            ),
                            "4": CardImage(
                                drive_id="4",
                                name="4.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "4 (4).png"),
                                slots={1},
                            ),
                        },
                        num_slots=2,
                        face=constants.Faces.front,
                    ),
                    backs=CardImageCollection(
                        cards_by_id={
                            "5": CardImage(
                                drive_id="5",
                                name="5.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "5 (5).png"),
                                slots={0, 1},
                            )
                        },
                        num_slots=2,
                        face=constants.Faces.back,
                    ),
                ),
            ],
            # expected order
            CardOrder(
                details=Details(quantity=4, stock=constants.Cardstocks.S30.value, foil=False),
                fronts=CardImageCollection(
                    cards_by_id={
                        "1": CardImage(
                            drive_id="1",
                            name="1.png",
                            file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                            slots={0, 1},
                        ),
                        "3": CardImage(
                            drive_id="3", name="3.png", file_path=os.path.join(CARDS_FILE_PATH, "3 (3).png"), slots={2}
                        ),
                        "4": CardImage(
                            drive_id="4", name="4.png", file_path=os.path.join(CARDS_FILE_PATH, "4 (4).png"), slots={3}
                        ),
                    },
                    num_slots=4,
                    face=constants.Faces.front,
                ),
                backs=CardImageCollection(
                    cards_by_id={
                        "2": CardImage(
                            drive_id="2",
                            name="2.png",
                            file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                            slots={0, 1},
                        ),
                        "5": CardImage(
                            drive_id="5",
                            name="5.png",
                            file_path=os.path.join(CARDS_FILE_PATH, "5 (5).png"),
                            slots={2, 3},
                        ),
                    },
                    num_slots=4,
                    face=constants.Faces.back,
                ),
            ),
        ),
        # endregion
    ],
    ids=[
        "two small orders which share the same singleton cardback",
        "region two small orders which do not share the same singleton cardback",
    ],
)
def test_combine_orders(input_orders: list[CardOrder], expected_order: CardOrder):
    assert_orders_identical(CardOrder.from_multiple_orders(input_orders), expected_order)


@pytest.fixture()
def monkeypatch_project_max_size(monkeypatch: pytest.MonkeyPatch) -> Callable[[int], None]:
    def func(project_max_size: int) -> None:
        monkeypatch.setattr(src.constants, "PROJECT_MAX_SIZE", project_max_size)

    return func


@pytest.fixture()
def monkeypatch_split_every_4_cards(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(src.order, "prompt", lambda _: {"split_choices": "Split every 4 cards"})


@pytest.fixture()
def monkeypatch_let_me_specify_how_to_split_the_cards(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(src.order, "prompt", lambda _: {"split_choices": "Let me specify how to split the cards"})


@pytest.mark.parametrize(
    "user_specified_sizes, expected_sizes",
    [
        ("2, 1, 2", [2, 1, 2]),
        ("2,1,2", [2, 1, 2]),
        ("2, 3", [2, 3]),
        ("4, 1", [4, 1]),
    ],
)
def test_get_project_sizes_manually_specifying_sizes(
    monkeypatch,
    monkeypatch_let_me_specify_how_to_split_the_cards,
    monkeypatch_project_max_size,
    user_specified_sizes,
    expected_sizes,
):
    order = CardOrder(
        details=Details(quantity=5, stock=constants.Cardstocks.S30.value, foil=False),
        fronts=CardImageCollection(
            cards_by_id={
                "1": CardImage(
                    drive_id="1",
                    name="1.png",
                    file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                    slots=set(range(5)),
                )
            },
            num_slots=5,
            face=constants.Faces.front,
        ),
        backs=CardImageCollection(
            cards_by_id={
                "2": CardImage(
                    drive_id="2",
                    name="2.png",
                    file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                    slots=set(range(5)),
                )
            },
            num_slots=5,
            face=constants.Faces.back,
        ),
    )
    monkeypatch_project_max_size(4)
    text_inputs = iter([user_specified_sizes])
    monkeypatch.setattr("builtins.input", lambda _: next(text_inputs))
    project_sizes = order.get_project_sizes()
    assert project_sizes == expected_sizes


@pytest.mark.parametrize("first_attempted_input", ["5, 0", "6, -1", "egg", "2, 2", "4, 0, 1"])
def test_get_project_sizes_manually_specifying_sizes_with_an_incorrect_attempt_first(
    monkeypatch, monkeypatch_let_me_specify_how_to_split_the_cards, monkeypatch_project_max_size, first_attempted_input
):
    order = CardOrder(
        details=Details(quantity=5, stock=constants.Cardstocks.S30.value, foil=False),
        fronts=CardImageCollection(
            cards_by_id={
                "1": CardImage(
                    drive_id="1",
                    name="1.png",
                    file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                    slots=set(range(5)),
                )
            },
            num_slots=5,
            face=constants.Faces.front,
        ),
        backs=CardImageCollection(
            cards_by_id={
                "2": CardImage(
                    drive_id="2",
                    name="2.png",
                    file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                    slots=set(range(5)),
                )
            },
            num_slots=5,
            face=constants.Faces.back,
        ),
    )
    monkeypatch_project_max_size(4)
    text_inputs = iter([first_attempted_input, "2, 3"])
    monkeypatch.setattr("builtins.input", lambda _: next(text_inputs))
    project_sizes = order.get_project_sizes()
    assert project_sizes == [2, 3]


def test_get_project_sizes_automatically_breaking_on_max_size(
    monkeypatch, monkeypatch_split_every_4_cards, monkeypatch_project_max_size
):
    order = CardOrder(
        details=Details(quantity=5, stock=constants.Cardstocks.S30.value, foil=False),
        fronts=CardImageCollection(
            cards_by_id={
                "1": CardImage(
                    drive_id="1",
                    name="1.png",
                    file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                    slots=set(range(5)),
                )
            },
            num_slots=5,
            face=constants.Faces.front,
        ),
        backs=CardImageCollection(
            cards_by_id={
                "2": CardImage(
                    drive_id="2",
                    name="2.png",
                    file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                    slots=set(range(5)),
                )
            },
            num_slots=5,
            face=constants.Faces.back,
        ),
    )
    monkeypatch_project_max_size(4)
    project_sizes = order.get_project_sizes()
    assert project_sizes == [4, 1]


@pytest.mark.parametrize(
    "input_orders, expected_orders",
    [
        (
            [
                CardOrder(
                    details=Details(quantity=5, stock=constants.Cardstocks.S30.value, foil=False),
                    fronts=CardImageCollection(
                        cards_by_id={
                            "1": CardImage(
                                drive_id="1",
                                name="1.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                                slots=set(range(5)),
                            )
                        },
                        num_slots=5,
                        face=constants.Faces.front,
                    ),
                    backs=CardImageCollection(
                        cards_by_id={
                            "2": CardImage(
                                drive_id="2",
                                name="2.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                                slots=set(range(5)),
                            )
                        },
                        num_slots=5,
                        face=constants.Faces.back,
                    ),
                ),
                CardOrder(
                    details=Details(quantity=2, stock=constants.Cardstocks.S30.value, foil=False),
                    fronts=CardImageCollection(
                        cards_by_id={
                            "1": CardImage(
                                drive_id="1",
                                name="1.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                                slots=set(range(2)),
                            )
                        },
                        num_slots=2,
                        face=constants.Faces.front,
                    ),
                    backs=CardImageCollection(
                        cards_by_id={
                            "2": CardImage(
                                drive_id="2",
                                name="2.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                                slots=set(range(2)),
                            )
                        },
                        num_slots=2,
                        face=constants.Faces.back,
                    ),
                ),
            ],
            [
                CardOrder(
                    details=Details(quantity=4, stock=constants.Cardstocks.S30.value, foil=False),
                    fronts=CardImageCollection(
                        cards_by_id={
                            "1": CardImage(
                                drive_id="1",
                                name="1.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                                slots=set(range(4)),
                            )
                        },
                        num_slots=4,
                        face=constants.Faces.front,
                    ),
                    backs=CardImageCollection(
                        cards_by_id={
                            "2": CardImage(
                                drive_id="2",
                                name="2.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                                slots=set(range(4)),
                            )
                        },
                        num_slots=4,
                        face=constants.Faces.back,
                    ),
                ),
                CardOrder(
                    details=Details(quantity=3, stock=constants.Cardstocks.S30.value, foil=False),
                    fronts=CardImageCollection(
                        cards_by_id={
                            "1": CardImage(
                                drive_id="1",
                                name="1.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "1 (1).png"),
                                slots=set(range(3)),
                            )
                        },
                        num_slots=3,
                        face=constants.Faces.front,
                    ),
                    backs=CardImageCollection(
                        cards_by_id={
                            "2": CardImage(
                                drive_id="2",
                                name="2.png",
                                file_path=os.path.join(CARDS_FILE_PATH, "2 (2).png"),
                                slots=set(range(3)),
                            )
                        },
                        num_slots=3,
                        face=constants.Faces.back,
                    ),
                ),
            ],
        ),
    ],
    ids=["sledgehammer_test"],
)
def test_aggregate_and_split_orders(
    monkeypatch, monkeypatch_project_max_size, monkeypatch_split_every_4_cards, input_orders, expected_orders
):
    monkeypatch_project_max_size(4)
    aggregated_orders = aggregate_and_split_orders(
        orders=input_orders, target_site=constants.TargetSites.MakePlayingCards, combine_orders=True
    )

    assert len(aggregated_orders) == len(expected_orders)

    def aggregate_orders_by_details_then_sort_by_quantity(
        orders: list[CardOrder],
    ) -> dict[tuple[constants.Cardstocks, bool], list[CardOrder]]:
        def key(order: CardOrder) -> int:
            return hash((order.details.foil, order.details.stock))

        return {
            key: sorted(values, key=lambda order: order.details.quantity)
            for key, values in groupby(sorted(orders, key=key), key=key)
        }

    aggregated_orders_dict = aggregate_orders_by_details_then_sort_by_quantity(aggregated_orders)
    expected_orders_dict = aggregate_orders_by_details_then_sort_by_quantity(expected_orders)
    assert aggregated_orders_dict.keys() == expected_orders_dict.keys()
    for key in aggregated_orders_dict.keys():
        assert len(aggregated_orders_dict[key]) == len(expected_orders_dict[key])
        for (aggregated_order, expected_order) in zip(aggregated_orders_dict[key], expected_orders_dict[key]):
            assert_orders_identical(aggregated_order, expected_order)


def test_aggregate_and_split_orders_single_order():
    """Tests the early return path when only one order is provided."""
    order = CardOrder(details=Details(quantity=1), fronts=CardImageCollection(), backs=CardImageCollection())
    orders = [order]
    result = aggregate_and_split_orders(orders, constants.TargetSites.MakePlayingCards, True)
    assert result is orders


# endregion

# region test PdfExporter


def test_pdf_export_complete_3_cards_single_file(monkeypatch, card_order_valid):
    def do_nothing(_):
        return None

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(order=card_order_valid)
    pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    expected_generated_files = [
        "export/test_order/1.pdf",
    ]

    for file_path in expected_generated_files:
        assert os.path.exists(file_path)
    remove_files(expected_generated_files)
    remove_directories(["export/test_order", "export"])


def test_pdf_export_complete_3_cards_separate_files(monkeypatch, card_order_valid):
    def do_nothing(_):
        return None

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(order=card_order_valid, number_of_cards_per_file=1)
    pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    expected_generated_files = ["export/test_order/1.pdf", "export/test_order/2.pdf", "export/test_order/3.pdf"]

    for file_path in expected_generated_files:
        assert os.path.exists(file_path)
    remove_files(expected_generated_files)
    remove_directories(["export/test_order", "export"])


def test_pdf_export_complete_separate_faces(monkeypatch, card_order_valid):
    def do_nothing(_):
        return None

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(order=card_order_valid, separate_faces=True, number_of_cards_per_file=1)
    pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    expected_generated_files = [
        "export/test_order/backs/1.pdf",
        "export/test_order/backs/2.pdf",
        "export/test_order/backs/3.pdf",
        "export/test_order/fronts/1.pdf",
        "export/test_order/fronts/2.pdf",
        "export/test_order/fronts/3.pdf",
    ]

    for file_path in expected_generated_files:
        assert os.path.exists(file_path)
    remove_files(expected_generated_files)
    remove_directories(["export/test_order/backs", "export/test_order/fronts", "export/test_order", "export"])


# endregion

# region test driver.py


@pytest.mark.flaky(retries=3, delay=1)
@pytest.mark.parametrize("browser", [constants.Browsers.chrome, constants.Browsers.edge])
@pytest.mark.parametrize(
    "site",
    [
        constants.TargetSites.MakePlayingCards,
        constants.TargetSites.PrinterStudio,
        constants.TargetSites.PrinterStudioDE,
        constants.TargetSites.PrinterStudioUK,
    ],
)
def test_card_order_complete_run_single_cardback(browser, site, input_enter, card_order_valid):
    autofill_driver = AutofillDriver(browser=browser, target_site=site, headless=True)
    autofill_driver.execute_order(
        order=card_order_valid,
        skip_setup=False,
        auto_save_threshold=None,
        post_processing_config=DEFAULT_POST_PROCESSING,
    )
    assert (
        len(
            WebDriverWait(autofill_driver.driver, 30).until(
                EC.presence_of_all_elements_located((By.CLASS_NAME, "m-itemside"))
            )
        )
        == 3
    )


@pytest.mark.flaky(retries=3, delay=1)
@pytest.mark.parametrize("browser", [constants.Browsers.chrome, constants.Browsers.edge])
@pytest.mark.parametrize(
    "site",
    [
        constants.TargetSites.MakePlayingCards,
        constants.TargetSites.PrinterStudio,
        constants.TargetSites.PrinterStudioDE,
        constants.TargetSites.PrinterStudioUK,
    ],
)
def test_card_order_complete_run_multiple_cardbacks(browser, site, input_enter, card_order_multiple_cardbacks):
    autofill_driver = AutofillDriver(browser=browser, target_site=site, headless=True)
    autofill_driver.execute_order(
        order=card_order_multiple_cardbacks,
        skip_setup=False,
        auto_save_threshold=None,
        post_processing_config=DEFAULT_POST_PROCESSING,
    )
    assert (
        len(
            WebDriverWait(autofill_driver.driver, 30).until(
                EC.presence_of_all_elements_located((By.CLASS_NAME, "m-itemside"))
            )
        )
        == 4
    )


# endregion

# region Fixtures for New Tests


@pytest.fixture()
def card_order_element_missing_details() -> ElementTree.Element:
    """Provides a CardOrder element that is missing the <details> tag."""
    return ElementTree.fromstring(
        textwrap.dedent(
            """
            <order>
                <fronts>
                    <card>
                        <id>some_id</id>
                        <slots>0</slots>
                        <name>a.png</name>
                    </card>
                </fronts>
                <cardback>some_cardback</cardback>
            </order>
            """
        )
    )


@pytest.fixture()
def card_order_element_front_slot_out_of_bounds() -> ElementTree.Element:
    """Provides a CardOrder where a front card has a slot index greater than the quantity."""
    return ElementTree.fromstring(
        textwrap.dedent(
            """
            <order>
                <details>
                    <quantity>2</quantity>
                    <stock>(S30) Standard Smooth</stock>
                    <foil>false</foil>
                </details>
                <fronts>
                    <card>
                        <id>some_id</id>
                        <slots>0,2</slots>
                        <name>a.png</name>
                    </card>
                </fronts>
                <cardback>some_cardback</cardback>
            </order>
            """
        )
    )


@pytest.fixture()
def card_image_collection_element_invalid_slots() -> ElementTree.Element:
    """Provides a CardImageCollection where a card's slots are out of bounds."""
    return ElementTree.fromstring(
        textwrap.dedent(
            """
            <fronts>
                <card>
                    <id>a</id>
                    <slots>0,3</slots>
                    <name>a.png</name>
                </card>
            </fronts>
            """
        )
    )


# endregion

# region New Test Cases


def test_card_order_missing_details(input_enter, card_order_element_missing_details):
    """
    Tests that parsing a CardOrder with a missing <details> tag exits gracefully.
    This covers the error handling path in `CardOrder.from_element`.
    """
    with pytest.raises(SystemExit) as exc_info:
        CardOrder.from_element(card_order_element_missing_details, allowed_to_exceed_project_max_size=False)
    assert exc_info.value.code == 0


def test_aggregate_orders_with_different_details(monkeypatch_project_max_size):
    """
    Tests that orders with different details (stock, foil) are not combined,
    even if `combine_orders` is True.
    """
    monkeypatch_project_max_size(10)
    orders = [
        CardOrder(
            details=Details(quantity=2, stock=constants.Cardstocks.S30.value, foil=False),
            fronts=CardImageCollection(num_slots=2),
            backs=CardImageCollection(num_slots=2),
        ),
        CardOrder(
            details=Details(quantity=2, stock=constants.Cardstocks.S33.value, foil=False),
            fronts=CardImageCollection(num_slots=2),
            backs=CardImageCollection(num_slots=2),
        ),
    ]
    aggregated = aggregate_and_split_orders(
        orders, target_site=constants.TargetSites.MakePlayingCards, combine_orders=True
    )
    # The orders should not have been combined
    assert len(aggregated) == 2
    assert sorted([o.details.quantity for o in aggregated]) == [2, 2]


def test_aggregate_orders_no_combine(monkeypatch_project_max_size):
    """
    Tests that orders are not combined when `combine_orders` is False.
    """
    monkeypatch_project_max_size(10)
    orders = [
        CardOrder(
            details=Details(quantity=2, stock=constants.Cardstocks.S30.value, foil=False),
            fronts=CardImageCollection(num_slots=2),
            backs=CardImageCollection(num_slots=2),
        ),
        CardOrder(
            details=Details(quantity=3, stock=constants.Cardstocks.S30.value, foil=False),
            fronts=CardImageCollection(num_slots=3),
            backs=CardImageCollection(num_slots=3),
        ),
    ]
    aggregated = aggregate_and_split_orders(
        orders, target_site=constants.TargetSites.MakePlayingCards, combine_orders=False
    )
    # The orders should remain separate
    assert len(aggregated) == 2
    assert sorted([o.details.quantity for o in aggregated]) == [2, 3]


# endregion

# region test io.py


def test_download_image_from_scryfall_success(monkeypatch):
    """
    Tests the successful download of an image from Scryfall by mocking the web request.
    """

    class MockSuccessResponse:
        status_code = 200
        content = b"test_image_data"

        def raise_for_status(self):
            pass

    # Mock requests.get to return a successful response
    monkeypatch.setattr("src.io.requests.get", lambda url, **kwargs: MockSuccessResponse())

    # Mock open and write to prevent actual file creation
    mock_file_storage = std_io.BytesIO()

    @contextmanager
    def mock_open_cm(path, mode):
        try:
            yield mock_file_storage
        finally:
            pass

    monkeypatch.setattr("builtins.open", mock_open_cm)

    result = download_image_from_url(
        "http://fake-scryfall-url.com/image", "scryfall_test.png", post_processing_config=None
    )

    assert result is True
    assert mock_file_storage.getvalue() == b"test_image_data"


def test_download_image_from_scryfall_failure(monkeypatch):
    """
    Tests the failure path when downloading an image from Scryfall.
    """

    class MockFailureResponse:
        status_code = 404
        content = b""

        def raise_for_status(self):
            raise requests.exceptions.HTTPError("404 Not Found")

    # Mock requests.get to return a failure response
    monkeypatch.setattr("src.io.requests.get", lambda url, **kwargs: MockFailureResponse())

    result = download_image_from_url("http://fake-scryfall-url.com/notfound", "scryfall_test_fail.png", None)

    assert result is False


def test_remove_files_os_error(monkeypatch):
    """
    Tests that an OSError during file removal is caught and handled.
    """

    def raise_os_error(path):
        raise OSError("Permission denied")

    # Make os.remove raise an OSError
    monkeypatch.setattr("src.io.os.remove", raise_os_error)

    # This should now execute without crashing
    remove_files(["non_existent_file.txt"])


def test_remove_directories_os_error(monkeypatch):
    """
    Tests that an OSError during directory removal is caught and handled.
    """

    def raise_os_error(path):
        raise OSError("Directory not empty")

    # Make os.rmdir raise an OSError
    monkeypatch.setattr("src.io.os.rmdir", raise_os_error)

    # This should now execute without crashing
    remove_directories(["non_existent_dir"])


# endregion

# region from_decklist tests

# Helper to create a valid, minimal PNG byte object
def create_dummy_png() -> bytes:
    """Creates a valid 1x1 black PNG in memory."""
    img = Image.new("RGB", (1, 1))
    byte_io = BytesIO()
    img.save(byte_io, "PNG")
    return byte_io.getvalue()


@pytest.fixture
def mock_scryfall_requests(monkeypatch):
    """Mocks requests.get to return canned Scryfall API responses."""

    # --- Mock Card Data ---
    sfc_card = {
        "object": "card",
        "id": "sfc-1",
        "name": "Llanowar Elves",
        "layout": "normal",
        "image_uris": {"png": "http://example.com/llanowar_elves.png"},
    }

    dfc_card = {
        "object": "card",
        "id": "dfc-1",
        "name": "Delver of Secrets // Insectile Aberration",
        "layout": "transform",
        "card_faces": [
            {"name": "Delver of Secrets", "image_uris": {"png": "http://example.com/delver.png"}},
            {"name": "Insectile Aberration", "image_uris": {"png": "http://example.com/insect.png"}},
        ],
    }

    meld_part_1 = {
        "object": "card",
        "id": "meld-part-1",
        "name": "Gisela, the Broken Blade",
        "layout": "meld",
        "image_uris": {"png": "http://example.com/gisela.png"},
        "all_parts": [
            {"component": "meld_part", "id": "meld-part-1", "name": "Gisela, the Broken Blade"},
            {"component": "meld_part", "id": "meld-part-2", "name": "Bruna, the Fading Light"},
            {"component": "meld_result", "uri": "http://api.scryfall.com/cards/meld-result-1"},
        ],
    }

    meld_part_2 = {
        "object": "card",
        "id": "meld-part-2",
        "name": "Bruna, the Fading Light",
        "layout": "meld",
        "image_uris": {"png": "http://example.com/bruna.png"},
        "all_parts": meld_part_1["all_parts"],  # Share the same all_parts
    }

    meld_result = {
        "object": "card",
        "id": "meld-result-1",
        "name": "Brisela, Voice of Nightmares",
        "image_uris": {"png": "http://example.com/brisela.png"},
    }

    # A DFC missing its back face
    dfc_missing_back = {
        "object": "card",
        "id": "dfc-missing-back",
        "name": "Incomplete DFC",
        "layout": "transform",
        "card_faces": [
            {"name": "Front Face", "image_uris": {"png": "http://example.com/front.png"}},
            {"name": "Back Face", "image_uris": {}},  # Missing PNG
        ],
    }

    # --- Mock Requests ---
    # Create a single dummy image to be returned by all successful image requests
    dummy_image_content = create_dummy_png()

    class MockResponse:
        def __init__(self, json_data, status_code=200, is_image=False):
            self._json_data = json_data
            self.status_code = status_code
            if is_image:
                self.content = dummy_image_content
            else:
                self.content = b""

        def json(self):
            return self._json_data

        def raise_for_status(self):
            if self.status_code >= 400:
                raise requests.exceptions.HTTPError(f"{self.status_code} Client Error")

    def mock_get(url, **kwargs):
        if "exact=Llanowar+Elves" in url:
            return MockResponse(sfc_card)
        if "exact=Delver+of+Secrets" in url:
            return MockResponse(dfc_card)
        if "exact=Gisela%2C+the+Broken+Blade" in url:
            return MockResponse(meld_part_1)
        if "exact=Bruna%2C+the+Fading+Light" in url:
            return MockResponse(meld_part_2)
        if url == "http://api.scryfall.com/cards/meld-result-1":
            return MockResponse(meld_result)
        if "exact=Card+Not+Found" in url:
            return MockResponse({"object": "error", "details": "Not Found"}, 404)
        if "exact=Incomplete+DFC" in url:
            return MockResponse(dfc_missing_back)
        if "exact=Meld+Fail" in url:
            meld_fail_part = meld_part_1.copy()
            meld_fail_part["name"] = "Meld Fail"
            meld_fail_part["all_parts"] = [
                {"component": "meld_part", "id": "meld-fail-1", "name": "Meld Fail"},
                {"component": "meld_result", "uri": "http://api.scryfall.com/cards/meld-fail-result"},
            ]
            return MockResponse(meld_fail_part)
        if url == "http://api.scryfall.com/cards/meld-fail-result":
            return MockResponse(None, 404)

        # Generic image response for ANY example.com URL
        if url.startswith("http://example.com"):
            return MockResponse(None, 200, is_image=True)

        return MockResponse(None, 404)

    monkeypatch.setattr(requests, "get", mock_get)


@pytest.fixture
def mock_user_prompts(monkeypatch, tmp_path):
    """Mocks all user-facing prompts (file dialogs, console prompts)."""
    # Mock Tkinter file dialogs
    mock_tk = mock.MagicMock()

    # Path for decklist
    decklist_file = tmp_path / "deck.txt"
    # Path for card back
    card_back_file = tmp_path / "card_back.png"
    Image.new("RGB", (10, 10)).save(card_back_file)

    # First call is for decklist, second is for card back
    mock_tk.askopenfilename.side_effect = [str(decklist_file), str(card_back_file)]
    monkeypatch.setattr("src.order.filedialog.askopenfilename", mock_tk.askopenfilename)

    # Mock InquirerPy prompts
    answers = {"stock": constants.Cardstocks.S30.value, "foil": False}
    monkeypatch.setattr("src.order.prompt", lambda q: answers)

    # Mock input for deck name
    monkeypatch.setattr("builtins.input", lambda _: "Test Deck")

    # Mock away the Tk root window
    monkeypatch.setattr("src.order.Tk", mock.MagicMock())

    return decklist_file


@pytest.fixture
def mock_fs(monkeypatch, tmp_path):
    """Mocks filesystem, image saving, and directory creation."""
    # Create a temporary 'cards' directory for the test run
    cards_dir = tmp_path / "cards"
    cards_dir.mkdir()

    # Mock the function that returns the image directory to isolate tests
    monkeypatch.setattr("src.order.image_directory", lambda: str(cards_dir))
    monkeypatch.setattr("src.io.image_directory", lambda: str(cards_dir))

    # By default, pretend no card images exist on disk yet
    # THIS IS THE CORRECTED PART
    original_os_path_exists = os.path.exists

    def new_mock_exists(path):
        # Allow the check for the cards directory to work correctly
        if "cards" in str(path):
            return original_os_path_exists(path)
        # For other paths (image files), return False to force download logic
        return False

    monkeypatch.setattr(os.path, "exists", new_mock_exists)

    monkeypatch.setattr(time, "sleep", lambda x: None)  # Disable sleep
    monkeypatch.setattr(Image.Image, "save", mock.MagicMock())  # Prevent actual image saving


def test_from_decklist_simple_cards(mock_user_prompts, mock_scryfall_requests, mock_fs, monkeypatch):
    """Tests a simple decklist with only single-faced cards."""
    decklist_file = mock_user_prompts
    decklist_content = "2 Llanowar Elves\n1 Forest"  # Forest will fail, testing robustness
    decklist_file.write_text(decklist_content, encoding="utf-8")

    # Mock the 'Forest' call to fail
    original_get = requests.get

    def side_effect_get(url, **kwargs):
        if "exact=Forest" in url:
            return mock.MagicMock(status_code=404, raise_for_status=lambda: exec("raise requests.exceptions.HTTPError"))
        return original_get(url, **kwargs)

    monkeypatch.setattr(requests, "get", side_effect_get)

    order = CardOrder.from_decklist()

    assert order.name == "Test Deck"
    assert order.details.quantity == 2  # 2 Llanowar Elves, Forest failed
    assert order.details.stock == constants.Cardstocks.S30.value
    assert not order.details.foil
    assert len(order.fronts.cards_by_id) == 1
    assert len(order.backs.cards_by_id) == 1  # Common back

    # Check that all 2 slots for backs are filled by the common back
    back_card = list(order.backs.cards_by_id.values())[0]
    assert back_card.name == "card_back.png"
    assert back_card.slots == {0, 1}


def test_from_decklist_double_faced_cards(mock_user_prompts, mock_scryfall_requests, mock_fs):
    """Tests a decklist with a double-faced card."""
    decklist_file = mock_user_prompts
    decklist_content = "1 Delver of Secrets"
    decklist_file.write_text(decklist_content)

    order = CardOrder.from_decklist()

    assert order.details.quantity == 1
    assert len(order.fronts.cards_by_id) == 1
    assert len(order.backs.cards_by_id) == 1

    front_card = list(order.fronts.cards_by_id.values())[0]
    back_card = list(order.backs.cards_by_id.values())[0]

    assert front_card.name == "Delver of Secrets.png"
    assert front_card.slots == {0}

    assert back_card.name == "Insectile Aberration.png"
    assert back_card.slots == {0}


def test_from_decklist_meld_cards_happy_path(mock_user_prompts, mock_scryfall_requests, mock_fs, monkeypatch):
    """Tests the successful processing of a meld card pair."""
    decklist_file = mock_user_prompts
    decklist_content = "1 Gisela, the Broken Blade\n1 Bruna, the Fading Light"
    decklist_file.write_text(decklist_content)

    # We need to mock the image processing part of the meld logic.
    # First, mock the generic image fetcher to prevent it from running for the front faces.
    # It's not what we're testing here.
    monkeypatch.setattr("src.order._fetch_and_prepare_image", lambda url, name: f"/tmp/{name}.png")

    # Now, set up specific mocks for the meld back image processing
    mock_img_instance = mock.MagicMock(spec=Image.Image)
    mock_img_instance.size = (800, 1120)
    mock_img_instance.mode = "RGB"

    # When crop is called, return another mock. This mock also needs a 'save' method.
    mock_crop_instance = mock.MagicMock(spec=Image.Image)
    mock_crop_instance.size = (400, 560)
    mock_crop_instance.mode = "RGB"
    mock_crop_instance.transpose.return_value = mock_crop_instance
    mock_crop_instance.save = mock.MagicMock()  # Mock the save method
    mock_img_instance.crop.return_value = mock_crop_instance

    # The only place `Image.open` is now called in the code flow is for the meld back.
    # We can safely mock it to return our pre-configured mock image instance.
    monkeypatch.setattr(Image, "open", lambda bio: mock_img_instance)

    # Mock ImageOps.expand to prevent it from crashing on the mock image object
    monkeypatch.setattr(ImageOps, "expand", lambda image, **kwargs: image)

    order = CardOrder.from_decklist()

    assert order.details.quantity == 2
    assert len(order.fronts.cards_by_id) == 2
    assert len(order.backs.cards_by_id) == 2

    mock_img_instance.crop.assert_called()
    mock_crop_instance.transpose.assert_called_with(Image.Transpose.ROTATE_90)

    back_names = {c.name for c in order.backs.cards_by_id.values()}
    assert "meld_back_Gisela, the Broken Blade.png" in back_names
    assert "meld_back_Bruna, the Fading Light.png" in back_names


def test_from_decklist_error_handling(mock_user_prompts, mock_scryfall_requests, mock_fs, caplog):
    """Tests various error conditions during decklist processing."""
    decklist_file = mock_user_prompts
    decklist_content = (
        "1 Card Not Found\n" "This is an invalid line\n" "1 Incomplete DFC\n" "1 Meld Fail\n" "1 Llanowar Elves\n"
    )
    decklist_file.write_text(decklist_content)

    caplog.set_level(logging.INFO)

    order = CardOrder.from_decklist()

    # Only Llanowar Elves (1) and Incomplete DFC (1) and Meld Fail (1) should be added
    assert order.details.quantity == 3

    logs = caplog.text
    assert "Error finding 'Card Not Found'" in logs
    assert "Could not parse quantity from line: 'This is an invalid line'" in logs
    assert "Back face missing for 'Incomplete DFC'" in logs
    assert "Could not process meld back for: Meld Fail" in logs

    # Check that DFC with missing back has its front and a placeholder back
    dfc_front_path = os.path.join(io.image_directory(), "Front Face.png")
    assert dfc_front_path in order.fronts.cards_by_id

    # Find the slot for the DFC
    dfc_slot = list(order.fronts.cards_by_id[dfc_front_path].slots)[0]

    # Check that the corresponding back slot is a missing placeholder
    back_for_dfc = next(c for c in order.backs.cards_by_id.values() if dfc_slot in c.slots)
    assert back_for_dfc.name == "MISSING_BACK.png"


# endregion
