import os
import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from typing import Generator
from xml.etree import ElementTree

import pytest
from enlighten import Counter
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

import src.constants as constants
import src.utils
from src.driver import AutofillDriver
from src.io import get_google_drive_file_name, remove_directories, remove_files
from src.order import CardImage, CardImageCollection, CardOrder, Details
from src.pdf_maker import PdfExporter
from src.processing import ImagePostProcessingConfig
from src.utils import text_to_list

DEFAULT_POST_PROCESSING = ImagePostProcessingConfig(max_dpi=800, downscale_alg=constants.ImageResizeMethods.LANCZOS)


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
    assert a.quantity == b.quantity and a.stock == b.stock and a.foil == b.foil


def assert_orders_identical(a: CardOrder, b: CardOrder) -> None:
    assert_details_identical(a.details, b.details)
    assert_card_image_collections_identical(a.fronts, b.fronts)
    assert_card_image_collections_identical(a.backs, b.backs)


def assert_file_size(file_path: str, size: int) -> None:
    assert os.stat(file_path).st_size == size


# endregion

# region constants

FILE_PATH = os.path.abspath(os.path.dirname(__file__))
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
                <id>{FILE_PATH}/cards/{TEST_IMAGE}.png</id>
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
                <cardback>{FILE_PATH}/cards/{TEST_IMAGE}.png</cardback>
            </order>
            """
        )
    )


@pytest.fixture()
def card_order_valid(card_order_element_valid: ElementTree.Element) -> Generator[CardOrder, None, None]:
    yield CardOrder.from_element(card_order_element_valid)


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
                        <id>{FILE_PATH}/cards/{TEST_IMAGE}.png</id>
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
    yield CardOrder.from_element(card_order_element_multiple_cardbacks)


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
                <cardback>{FILE_PATH}/cards/{TEST_IMAGE}.png</cardback>
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
                <cardback>{FILE_PATH}/cards/{TEST_IMAGE}.png</cardback>
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


# endregion

# region test CardImageCollection


def test_card_image_collection_download(card_image_collection_valid, counter, image_google_valid_drive_no_name, pool):
    assert card_image_collection_valid.slots() == {0, 1, 2}
    assert [x.file_exists() for x in card_image_collection_valid.cards] == [False, True]
    card_image_collection_valid.download_images(
        pool=pool, download_bar=counter, post_processing_config=DEFAULT_POST_PROCESSING
    )
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
        Details(quantity=1, stock=constants.Cardstocks.S30, foil=False),
    )


def test_details_quantity_greater_than_max_size(input_enter, details_element_quantity_greater_than_max_size):
    with pytest.raises(SystemExit) as exc_info:
        Details.from_element(details_element_quantity_greater_than_max_size)
    assert exc_info.value.code == 0


def test_details_invalid_cardstock(input_enter, details_element_invalid_cardstock):
    with pytest.raises(SystemExit) as exc_info:
        Details.from_element(details_element_invalid_cardstock)
    assert exc_info.value.code == 0


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
                cards=[
                    CardImage(
                        drive_id=SIMPLE_CUBE_ID,
                        slots=[0],
                        name=f"{SIMPLE_CUBE}.png",
                        file_path=f"{FILE_PATH}/cards/{SIMPLE_CUBE} ({SIMPLE_CUBE_ID}).png",  # not on disk
                        query="simple cube",
                    ),
                    CardImage(
                        drive_id=SIMPLE_LOTUS_ID,
                        slots=[1, 2],
                        name=f"{SIMPLE_LOTUS}.png",
                        file_path=f"{FILE_PATH}/cards/{SIMPLE_LOTUS}.png",  # already exists on disk
                        query="simple lotus",
                    ),
                ],
            ),
            backs=CardImageCollection(
                face=constants.Faces.back,
                num_slots=3,
                cards=[
                    CardImage(
                        drive_id=f"{FILE_PATH}/cards/{TEST_IMAGE}.png",
                        slots=[0],  # for orders with a single back image, the back image is only assigned to slot 0
                        name=f"{TEST_IMAGE}.png",  # name retrieved from file on disk
                        file_path=f"{FILE_PATH}/cards/{TEST_IMAGE}.png",
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
                stock=constants.Cardstocks.M31,
                foil=False,
            ),
            fronts=CardImageCollection(
                face=constants.Faces.front,
                num_slots=4,
                cards=[
                    CardImage(
                        drive_id=f"{FILE_PATH}/cards/{TEST_IMAGE}.png",
                        slots=[0, 3],
                        name=f"{TEST_IMAGE}.png",  # name retrieved from file on disk
                        file_path=f"{FILE_PATH}/cards/{TEST_IMAGE}.png",
                        query=None,
                    ),
                    CardImage(
                        drive_id=SIMPLE_LOTUS_ID,
                        slots=[1, 2],
                        name=f"{SIMPLE_LOTUS}.png",
                        file_path=f"{FILE_PATH}/cards/{SIMPLE_LOTUS}.png",  # already exists on disk
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
                        file_path=f"{FILE_PATH}/cards/{SIMPLE_LOTUS}.png",  # already exists on disk
                        query="simple lotus",
                    ),
                    CardImage(
                        drive_id=SIMPLE_CUBE_ID,
                        slots=[0, 2, 3],
                        name=f"{SIMPLE_CUBE}.png",
                        file_path=f"{FILE_PATH}/cards/{SIMPLE_CUBE} ({SIMPLE_CUBE_ID}).png",  # not on disk
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
                        file_path=f"{FILE_PATH}/cards/Island (Unsanctioned).png",
                        query="island",
                    ),
                    CardImage(
                        drive_id="1wlrM7pNHQ5NqS9GY5LWH7Hd04TtNgHI4",
                        slots=[9],
                        name="Rite of Flame.png",
                        file_path=f"{FILE_PATH}/cards/Rite of Flame.png",
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
                        file_path=f"{FILE_PATH}/cards/MTGA Lotus.png",
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


def test_card_order_missing_slots(input_enter, card_order_element_invalid_quantity):
    # just testing that this order parses without error
    CardOrder.from_element(card_order_element_invalid_quantity)


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
    autofill_driver = AutofillDriver(order=card_order_valid, browser=browser, target_site=site, headless=True)
    autofill_driver.execute(skip_setup=False, auto_save_threshold=None, post_processing_config=DEFAULT_POST_PROCESSING)
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
    autofill_driver = AutofillDriver(
        order=card_order_multiple_cardbacks, browser=browser, target_site=site, headless=True
    )
    autofill_driver.execute(skip_setup=False, auto_save_threshold=None, post_processing_config=DEFAULT_POST_PROCESSING)
    assert (
        len(
            WebDriverWait(autofill_driver.driver, 30).until(
                EC.presence_of_all_elements_located((By.CLASS_NAME, "m-itemside"))
            )
        )
        == 4
    )


# endregion
