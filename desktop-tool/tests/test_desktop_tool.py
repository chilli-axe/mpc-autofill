import os
import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from itertools import groupby
from queue import Queue
from typing import Callable, Generator
from xml.etree import ElementTree

import pytest
from enlighten import Counter
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

import src
import src.constants as constants
from src.constants import OrderFulfilmentMethod, SourceType
from src.driver import AutofillDriver
from src.exc import ValidationException
from src.formatting import text_to_set
from src.io import get_google_drive_file_name, remove_directories, remove_files
from src.order import (
    CardImage,
    CardImageCollection,
    CardOrder,
    Details,
    aggregate_and_split_orders,
)
import autofill as autofill_cli
from src.pdf_maker import PdfExporter, get_ghostscript_version
from src.processing import ImagePostProcessingConfig

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
    assert a.num_slots == b.num_slots, f"Number of slots {a.num_slots} does not match {b.num_slots}"
    assert len(a.cards_by_id) == len(
        b.cards_by_id
    ), f"Number of cards {len(a.cards_by_id)} does not match {len(b.cards_by_id)}"
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

# region Ghostscript


def test_get_ghostscript_version_reads_stdout(monkeypatch: pytest.MonkeyPatch) -> None:
    class Result:
        def __init__(self) -> None:
            self.stdout = "10.02.1\n"

    def fake_run(*_args, **_kwargs):
        return Result()

    monkeypatch.setattr("src.pdf_maker.subprocess.run", fake_run)
    assert get_ghostscript_version("gs") == "10.02.1"


def test_ensure_ghostscript_available_prompts_until_found(
    monkeypatch: pytest.MonkeyPatch, input_enter
) -> None:
    paths = [None, "/usr/local/bin/gs"]
    called = {"version": 0}

    def fake_get_path():
        return paths.pop(0)

    def fake_get_version(_path: str) -> str:
        called["version"] += 1
        return "10.0.0"

    monkeypatch.setattr(autofill_cli, "get_ghostscript_path", fake_get_path)
    monkeypatch.setattr(autofill_cli, "get_ghostscript_version", fake_get_version)

    assert autofill_cli.ensure_ghostscript_available() == "/usr/local/bin/gs"
    assert called["version"] == 1


# endregion

# region PDF/X conversion


def test_pdf_exporter_appends_pdfx_on_success(monkeypatch: pytest.MonkeyPatch, card_order_valid) -> None:
    def do_nothing(_):
        return None

    def fake_convert_pdf_to_pdfx(source_path: str, output_path: str, _config) -> bool:
        with open(output_path, "wb") as f:
            f.write(b"pdfx")
        return True

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    monkeypatch.setattr("src.pdf_maker.convert_pdf_to_pdfx", fake_convert_pdf_to_pdfx)

    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(
        order=card_order_valid,
        number_of_cards_per_file=1,
        pdfx_config=autofill_cli.PdfXConversionConfig(icc_profile_path="dummy.icc"),
    )
    generated_files = pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    expected_pdfx_files = [
        "export/test_order/1_pdfx.pdf",
        "export/test_order/2_pdfx.pdf",
        "export/test_order/3_pdfx.pdf",
    ]
    for file_path in expected_pdfx_files:
        assert file_path in generated_files
        assert os.path.exists(file_path)

    remove_files([path for path in generated_files if path.endswith(".pdf")])
    remove_directories(["export/test_order", "export"])


def test_pdf_exporter_skips_pdfx_on_failure(monkeypatch: pytest.MonkeyPatch, card_order_valid) -> None:
    def do_nothing(_):
        return None

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    monkeypatch.setattr("src.pdf_maker.convert_pdf_to_pdfx", lambda *_args, **_kwargs: False)

    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(
        order=card_order_valid,
        number_of_cards_per_file=1,
        pdfx_config=autofill_cli.PdfXConversionConfig(icc_profile_path="dummy.icc"),
    )
    generated_files = pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    assert not any(path.endswith("_pdfx.pdf") for path in generated_files)

    remove_files([path for path in generated_files if path.endswith(".pdf")])
    remove_directories(["export/test_order", "export"])


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
    monkeypatch.setattr(src.io, "DEFAULT_WORKING_DIRECTORY", FILE_PATH)
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
                <sourceType>{SourceType.LOCAL_FILE}</sourceType>
                <slots>0</slots>
                <name>{TEST_IMAGE}.png</name>
                <query>test image</query>
            </card>
            """
        )
    )


@pytest.fixture()
def image_element_local_file_inferred_type() -> Generator[ElementTree.Element, None, None]:
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
    card_image = CardImage.from_element(working_directory=FILE_PATH, element=image_element_local_file)
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
    card_image = CardImage.from_element(working_directory=FILE_PATH, element=image_element_invalid_google_drive)
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
    card_image = CardImage.from_element(working_directory=FILE_PATH, element=image_element_valid_google_drive)
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
    card_image = CardImage.from_element(working_directory=FILE_PATH, element=image_element_valid_google_drive_on_disk)
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
    card_image = CardImage.from_element(working_directory=FILE_PATH, element=image_element_google_valid_drive_no_name)
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
        working_directory=FILE_PATH,
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
    yield CardOrder.from_element(
        working_directory=FILE_PATH, element=card_order_element_valid, allowed_to_exceed_project_max_size=False
    )


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
    yield CardOrder.from_element(
        working_directory=FILE_PATH,
        element=card_order_element_multiple_cardbacks,
        allowed_to_exceed_project_max_size=False,
    )


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


def test_generate_file_path_infer_local_file(image_element_local_file_inferred_type):
    image = CardImage.from_element(working_directory=FILE_PATH, element=image_element_local_file_inferred_type)
    assert image.file_exists()
    assert image.source_type == SourceType.LOCAL_FILE


def test_download_google_drive_image_default_post_processing(
    image_valid_google_drive: CardImage, counter: Counter, queue: Queue[CardImage]
):
    image_valid_google_drive.download_image(
        download_bar=counter, queue=queue, post_processing_config=DEFAULT_POST_PROCESSING
    )
    assert image_valid_google_drive.file_exists() is True
    assert image_valid_google_drive.errored is False
    assert_file_size(image_valid_google_drive.file_path, 152990)


def test_download_local_file_is_no_op(image_local_file: CardImage, counter: Counter, queue: Queue[CardImage]):
    assert image_local_file.file_exists() is True
    file_size = os.stat(image_local_file.file_path).st_size
    image_local_file.download_image(download_bar=counter, queue=queue, post_processing_config=DEFAULT_POST_PROCESSING)
    assert image_local_file.file_exists() is True
    assert image_local_file.errored is False
    assert_file_size(image_local_file.file_path, file_size)


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
    with pytest.raises(ValidationException):
        CardImageCollection.from_element(
            working_directory=FILE_PATH,
            element=card_image_collection_element_no_cards,
            face=constants.Faces.front,
            num_slots=3,
        )


# endregion

# region test Details


def test_details_valid(details_element_valid):
    details = Details.from_element(element=details_element_valid, allowed_to_exceed_project_max_size=False)
    assert_details_identical(
        details,
        Details(quantity=1, stock=constants.Cardstocks.S30, foil=False),
    )


def test_details_quantity_greater_than_max_size(input_enter, details_element_quantity_greater_than_max_size):
    with pytest.raises(ValidationException):
        Details.from_element(details_element_quantity_greater_than_max_size, allowed_to_exceed_project_max_size=False)


def test_details_invalid_cardstock(input_enter, details_element_invalid_cardstock):
    with pytest.raises(ValidationException):
        Details.from_element(details_element_invalid_cardstock, allowed_to_exceed_project_max_size=False)


# endregion

# region test CardOrder


def test_card_order_valid(card_order_valid):
    assert_orders_identical(
        card_order_valid,
        CardOrder(
            details=Details(
                quantity=3,
                stock=constants.Cardstocks.S30,
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
                stock=constants.Cardstocks.M31,
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
    card_order = CardOrder.from_file_path(working_directory=FILE_PATH, file_path="test_order.xml")
    for card in (card_order.fronts.cards_by_id | card_order.backs.cards_by_id).values():
        assert not card.file_exists()
    assert_orders_identical(
        card_order,
        CardOrder(
            details=Details(
                quantity=10,
                stock=constants.Cardstocks.S30,
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
    with pytest.raises(ValidationException):
        CardOrder.from_file_path(
            working_directory=FILE_PATH, file_path="mangled.xml"
        )  # file is missing closing ">" at end


def test_card_order_missing_slots(input_enter, card_order_element_invalid_quantity):
    # just testing that this order parses without error
    CardOrder.from_element(
        working_directory=FILE_PATH,
        element=card_order_element_invalid_quantity,
        allowed_to_exceed_project_max_size=False,
    )


@pytest.mark.parametrize(
    "input_orders, expected_order",
    [
        # region two small orders which share the same singleton cardback
        (
            # input orders
            [
                CardOrder(
                    details=Details(quantity=2, stock=constants.Cardstocks.S30, foil=False),
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
                    details=Details(quantity=2, stock=constants.Cardstocks.S30, foil=False),
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
                details=Details(quantity=4, stock=constants.Cardstocks.S30, foil=False),
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
                    details=Details(quantity=2, stock=constants.Cardstocks.S30, foil=False),
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
                    details=Details(quantity=2, stock=constants.Cardstocks.S30, foil=False),
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
                details=Details(quantity=4, stock=constants.Cardstocks.S30, foil=False),
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
        details=Details(quantity=5, stock=constants.Cardstocks.S30, foil=False),
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
        details=Details(quantity=5, stock=constants.Cardstocks.S30, foil=False),
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
        details=Details(quantity=5, stock=constants.Cardstocks.S30, foil=False),
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
                    details=Details(quantity=5, stock=constants.Cardstocks.S30, foil=False),
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
                    details=Details(quantity=2, stock=constants.Cardstocks.S30, foil=False),
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
                    details=Details(quantity=4, stock=constants.Cardstocks.S30, foil=False),
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
                    details=Details(quantity=3, stock=constants.Cardstocks.S30, foil=False),
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
        for aggregated_order, expected_order in zip(aggregated_orders_dict[key], expected_orders_dict[key]):
            assert_orders_identical(aggregated_order, expected_order)


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
@pytest.mark.parametrize("browser", [constants.Browsers.chrome])  # , constants.Browsers.edge
@pytest.mark.parametrize(
    "site",
    [
        constants.TargetSites.MakePlayingCards,
        constants.TargetSites.PrinterStudio,
        constants.TargetSites.PrinterStudioDE,
        constants.TargetSites.PrinterStudioUK,
        constants.TargetSites.PrinterStudioES,
        constants.TargetSites.PrinterStudioFR,
    ],
)
def test_card_order_complete_run_single_cardback(browser, site, input_enter, card_order_valid):
    autofill_driver = AutofillDriver(browser=browser, target_site=site, headless=True)
    autofill_driver.execute_order(
        order=card_order_valid,
        fulfilment_method=OrderFulfilmentMethod.new_project,
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
@pytest.mark.parametrize("browser", [constants.Browsers.chrome])  # , constants.Browsers.edge
@pytest.mark.parametrize(
    "site",
    [
        constants.TargetSites.MakePlayingCards,
        constants.TargetSites.PrinterStudio,
        constants.TargetSites.PrinterStudioDE,
        constants.TargetSites.PrinterStudioUK,
        constants.TargetSites.PrinterStudioES,
        constants.TargetSites.PrinterStudioFR,
    ],
)
def test_card_order_complete_run_multiple_cardbacks(browser, site, input_enter, card_order_multiple_cardbacks):
    autofill_driver = AutofillDriver(browser=browser, target_site=site, headless=True)
    autofill_driver.execute_order(
        order=card_order_multiple_cardbacks,
        fulfilment_method=OrderFulfilmentMethod.new_project,
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
