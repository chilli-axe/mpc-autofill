import re
from io import BytesIO
from pathlib import Path
from queue import Queue
from types import SimpleNamespace

import pytest
from PIL import Image

from src.constants import Faces, ImageResizeMethods, SourceType
from src.order import CardImage, CardImageCollection, CardOrder, Details, is_image_valid
from src.pdf_maker import PdfExporter
from src.processing import (
    ImagePostProcessingConfig,
    post_process_image,
    save_processed_image,
)


def image_bytes(image: Image.Image, format: str = "PNG") -> bytes:
    with BytesIO() as buffer:
        image.save(buffer, format=format)
        return buffer.getvalue()


def test_indexed_png_exports_as_jpeg():
    image = Image.new("P", (32, 32))
    image.putpalette([0, 255, 0] * 256)
    config = ImagePostProcessingConfig(300, ImageResizeMethods.LANCZOS, output_format="JPEG")
    processed = post_process_image(image_bytes(image), config)
    with BytesIO() as output:
        save_processed_image(processed, output, config)
        output.seek(0)
        with Image.open(output) as decoded:
            assert decoded.format == "JPEG"
            assert decoded.mode == "RGB"
            red, green, blue = decoded.getpixel((0, 0))
            assert red < 5 and green > 250 and blue < 5


@pytest.mark.parametrize("mode", ["P", "RGBA", "LA"])
def test_jpeg_flattens_transparency_on_white(mode):
    image = Image.new(mode, (32, 32), 0)
    if mode == "P":
        image.info["transparency"] = 0
    config = ImagePostProcessingConfig(
        300, ImageResizeMethods.LANCZOS, output_format="JPEG", target_pixel_size=(16, 16)
    )
    processed = post_process_image(image_bytes(image), config)
    assert processed.mode == "RGB"
    assert processed.size == (16, 16)
    assert processed.getpixel((0, 0)) == (255, 255, 255)


@pytest.mark.parametrize("source", ["local", "cached", "download", "permanently_corrupt"])
def test_truncated_jpeg_validation_and_download_retry(monkeypatch, tmp_path, source):
    valid = image_bytes(Image.new("RGB", (819, 1113), "red"), "JPEG")
    truncated = valid[:-300]
    path = tmp_path / "card.jpg"
    if source in ("local", "cached"):
        path.write_bytes(truncated)
        assert not is_image_valid(str(path))
    calls = []

    def download(**_kwargs):
        calls.append(True)
        path.write_bytes(valid if source == "cached" or (source == "download" and len(calls) == 2) else truncated)
        return True

    monkeypatch.setattr("src.order.download_google_drive_file", download)
    card = CardImage(
        drive_id="card",
        name="card.jpg",
        file_path=str(path),
        slots={0},
        source_type=SourceType.LOCAL_FILE if source == "local" else SourceType.GOOGLE_DRIVE,
    )
    card.download_image(Queue(), SimpleNamespace(update=lambda: None, refresh=lambda: None), None)
    succeeds = source in ("cached", "download")
    assert card.downloaded is succeeds
    assert card.errored is not succeeds
    assert len(calls) == {"local": 0, "cached": 1, "download": 2, "permanently_corrupt": 2}[source]
    if succeeds:
        assert path.read_bytes() == valid
    elif source == "local":
        assert path.read_bytes() == truncated  # Never delete the user's source image.
    else:
        assert not path.exists()


def test_truncated_download_retries_when_post_processing(monkeypatch, tmp_path):
    valid = image_bytes(Image.new("RGB", (819, 1113), "red"), "JPEG")
    downloads = []

    class Downloader:
        def __init__(self, buffer, _request):
            self.buffer = buffer

        def next_chunk(self):
            downloads.append(True)
            self.buffer.write(valid[:-300] if len(downloads) == 1 else valid)
            return None, True

    monkeypatch.setattr("src.io.MediaIoBaseDownload", Downloader)
    monkeypatch.setattr(
        "src.io.find_or_create_google_drive_service",
        lambda: SimpleNamespace(files=lambda: SimpleNamespace(get_media=lambda **_kwargs: None)),
    )
    path = tmp_path / "card.jpg"
    card = CardImage(drive_id="card", name=path.name, file_path=str(path), slots={0})
    card.download_image(
        Queue(),
        SimpleNamespace(update=lambda: None, refresh=lambda: None),
        ImagePostProcessingConfig(300, ImageResizeMethods.LANCZOS),
    )
    assert len(downloads) == 2
    assert card.downloaded and not card.errored
    assert is_image_valid(str(path))


@pytest.mark.parametrize("slots", [(0, 2), (1, 3)])
@pytest.mark.parametrize("mode", ["standard", "drive_thru_cards"])
def test_sparse_slots_preserve_all_cards_and_dtc_jpeg_deduplication(monkeypatch, tmp_path, slots, mode):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(PdfExporter, "ask_questions", lambda self: None)
    images = {}
    for name, color in (("first", "red"), ("second", "blue"), ("back", "black")):
        path = tmp_path / f"{name}.png"
        Image.new("RGB", (32, 32), color).save(path)
        images[name] = CardImage(
            drive_id=name,
            name=path.name,
            file_path=str(path),
            source_type=SourceType.LOCAL_FILE,
            slots=set(slots) if name == "back" else {slots[0 if name == "first" else 1]},
        )
    order = CardOrder(
        name="sparse",
        details=Details(quantity=max(slots) + 1),
        fronts=CardImageCollection(
            cards_by_id={name: images[name] for name in ("first", "second")},
            num_slots=max(slots) + 1,
            face=Faces.front,
        ),
        backs=CardImageCollection(cards_by_id={"back": images["back"]}, num_slots=max(slots) + 1, face=Faces.back),
    )
    exporter = PdfExporter(order=order, export_mode=mode, number_of_cards_per_file=1)
    config = ImagePostProcessingConfig(300, ImageResizeMethods.LANCZOS, output_format="JPEG")
    outputs = [Path(path).read_bytes() for path in exporter.execute(config)]
    page_counts = [len(re.findall(rb"/Type /Page\b", output)) for output in outputs]
    assert page_counts == ([4] if mode == "drive_thru_cards" else [2, 2])
    if mode == "drive_thru_cards":
        assert outputs[0].count(b"DCTDecode") == 3
    assert exporter.processed_images == {}
