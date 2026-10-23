import json
import os
from pathlib import Path

import attr
import autofill
import pytest
from PIL import Image

from src import pdf_maker
from src.constants import Faces, ImageResizeMethods, SourceType
from src.order import CardImage, CardImageCollection, CardOrder, Details
from src.pdf_cache import reuse_pdf_export, save_pdf_export
from src.pdf_maker import PdfXConversionConfig
from src.processing import ImagePostProcessingConfig


def make_order(image_path: Path) -> CardOrder:
    def face(side: Faces) -> CardImageCollection:
        card = CardImage(
            drive_id=str(image_path),
            file_path=str(image_path),
            name=image_path.name,
            source_type=SourceType.LOCAL_FILE,
            slots={0, 1},
        )
        return CardImageCollection(cards_by_id={card.drive_id: card}, num_slots=2, face=side)

    return CardOrder(name="deck.xml", details=Details(quantity=2), fronts=face(Faces.front), backs=face(Faces.back))


@pytest.fixture
def cached_export(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    image_path = tmp_path / "original.png"
    Image.new("RGB", (20, 30), "red").save(image_path)
    icc_path = tmp_path / "print.icc"
    icc_path.write_bytes(b"original ICC profile")
    output = Path("export/deck/1_pdfx.pdf")
    output.parent.mkdir(parents=True)
    output.write_bytes(b"%PDF-1.3 original output")
    save_pdf_export(make_order(image_path), "DTC 300 DPI", [str(icc_path)], [str(output)])
    return image_path, icc_path, output


def test_reuses_new_order_without_runtime_flags(cached_export):
    image_path, icc_path, output = cached_export
    order = make_order(image_path)
    for face in (order.fronts, order.backs):
        face.queue.put(("old download", True))
        for card in face.cards_by_id.values():
            card.downloaded = card.uploaded = card.errored = True
            card.pid = "previous session PID"
    assert reuse_pdf_export(order, "DTC 300 DPI", [str(icc_path)]) == [str(output)]


@pytest.mark.parametrize("changed_file", ["image", "icc", "pdf"])
def test_same_mtime_content_changes_invalidate_cache(cached_export, changed_file):
    image_path, icc_path, output = cached_export
    path = {"image": image_path, "icc": icc_path, "pdf": output}[changed_file]
    before = path.stat()
    contents = path.read_bytes()
    path.write_bytes(bytes([contents[0] ^ 1]) + contents[1:])
    os.utime(path, ns=(before.st_atime_ns, before.st_mtime_ns))
    assert path.stat().st_size == before.st_size
    assert path.stat().st_mtime_ns == before.st_mtime_ns
    assert reuse_pdf_export(make_order(image_path), "DTC 300 DPI", [str(icc_path)]) is None


@pytest.mark.parametrize("changed", ["slots", "quantity", "face", "settings", "profile"])
def test_order_and_export_settings_changes_invalidate_cache(cached_export, changed):
    image_path, icc_path, _ = cached_export
    order = make_order(image_path)
    settings = "DTC 300 DPI"
    extras = [str(icc_path)]
    if changed == "slots":
        next(iter(order.fronts.cards_by_id.values())).slots = {0, 2}
    elif changed == "quantity":
        order.details = attr.evolve(order.details, quantity=3)
    elif changed == "face":
        next(iter(order.backs.cards_by_id.values())).slots = {0}
    elif changed == "settings":
        settings = "standard 600 DPI"
    else:
        extras = []
    assert reuse_pdf_export(order, settings, extras) is None


@pytest.mark.parametrize("missing", ["image", "icc", "pdf", "manifest"])
def test_missing_inputs_outputs_or_legacy_manifest_force_rebuild(cached_export, missing):
    image_path, icc_path, output = cached_export
    path = {"image": image_path, "icc": icc_path, "pdf": output, "manifest": output.parent / "manifest.json"}[missing]
    path.unlink()
    assert reuse_pdf_export(make_order(image_path), "DTC 300 DPI", [str(icc_path)]) is None


@pytest.mark.parametrize("contents", ["{", "null", "[]", "{}", '{"fingerprint": 0}'])
def test_malformed_manifests_are_cache_misses(cached_export, contents):
    image_path, icc_path, output = cached_export
    (output.parent / "manifest.json").write_text(contents, encoding="utf-8")
    assert reuse_pdf_export(make_order(image_path), "DTC 300 DPI", [str(icc_path)]) is None


@pytest.mark.parametrize("outputs", [None, [], {}, {"../outside.pdf": "digest"}, {"notes.txt": "digest"}])
def test_invalid_output_lists_are_cache_misses(cached_export, outputs):
    image_path, icc_path, output = cached_export
    manifest_path = output.parent / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["outputs"] = outputs
    manifest_path.write_text(json.dumps(manifest))
    assert reuse_pdf_export(make_order(image_path), "DTC 300 DPI", [str(icc_path)]) is None


def test_manifest_cannot_reuse_existing_pdf_outside_export_directory(cached_export):
    image_path, icc_path, output = cached_export
    outside = Path("export/outside.pdf")
    outside.write_bytes(output.read_bytes())
    manifest_path = output.parent / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["outputs"] = {"../outside.pdf": next(iter(manifest["outputs"].values()))}
    manifest_path.write_text(json.dumps(manifest))
    assert reuse_pdf_export(make_order(image_path), "DTC 300 DPI", [str(icc_path)]) is None


def test_dtc_export_reuses_fresh_order_and_rebuilds_same_mtime_image(cached_export, monkeypatch):
    image_path, icc_path, _ = cached_export
    conversions = []

    def convert(source, destination, config):
        conversions.append(destination)
        Path(destination).write_bytes(Path(source).read_bytes())
        return True

    monkeypatch.setattr(pdf_maker, "convert_pdf_to_pdfx", convert)
    monkeypatch.setattr(autofill, "get_ghostscript_path", lambda *_: "test-gs")
    monkeypatch.setattr(autofill, "get_ghostscript_version", lambda _: "test version")

    def export():
        return autofill.get_dtc_pdf_paths_for_order(make_order(image_path), True, str(icc_path), "LANCZOS")

    original = [Path(path) for path in export()]
    assert len(conversions) == 1
    assert all(path.read_bytes().startswith(b"%PDF") for path in original)
    with monkeypatch.context() as context:
        context.setattr(pdf_maker, "PdfExporter", lambda **_: pytest.fail("unchanged export instantiated PdfExporter"))
        assert [Path(path) for path in export()] == original

    before = image_path.stat()
    Image.new("RGB", (20, 30), "blue").save(image_path)
    os.utime(image_path, ns=(before.st_atime_ns, before.st_mtime_ns))
    export()
    assert len(conversions) == 2


def test_standard_export_reuses_prior_layout_without_prompt(cached_export, monkeypatch):
    image_path, _, _ = cached_export
    questions = []

    def select_layout(_):
        questions.append(True)
        return {"split_faces": True}

    monkeypatch.setattr(pdf_maker.InquirerPy, "prompt", select_layout)

    def export(skip):
        config = ImagePostProcessingConfig(max_dpi=300, downscale_alg=ImageResizeMethods.LANCZOS)
        return autofill.export_pdf_order(make_order(image_path), skip, config)

    original = [Path(path) for path in export(True)]
    assert len(original) == 4
    assert len(questions) == 1
    with monkeypatch.context() as context:
        context.setattr(pdf_maker, "PdfExporter", lambda **_: pytest.fail("reused export requested its layout again"))
        assert [Path(path) for path in export(True)] == original
    export(False)
    assert len(questions) == 2


def test_dtc_cache_accepts_same_config_object_on_second_export(cached_export, monkeypatch):
    image_path, icc_path, _ = cached_export

    def convert(source, destination, config):
        Path(destination).write_bytes(Path(source).read_bytes())
        return True

    monkeypatch.setattr(pdf_maker, "convert_pdf_to_pdfx", convert)
    monkeypatch.setattr(autofill, "get_ghostscript_path", lambda *_: "test-gs")
    monkeypatch.setattr(autofill, "get_ghostscript_version", lambda _: "test version")
    post_config = ImagePostProcessingConfig(max_dpi=300, downscale_alg=ImageResizeMethods.LANCZOS, output_format="JPEG")
    pdfx_config = PdfXConversionConfig(icc_profile_path=str(icc_path))
    original = autofill.export_pdf_order(make_order(image_path), True, post_config, pdfx_config)
    monkeypatch.setattr(pdf_maker, "PdfExporter", lambda **_: pytest.fail("same settings object caused a cache miss"))
    assert [
        Path(path) for path in autofill.export_pdf_order(make_order(image_path), True, post_config, pdfx_config)
    ] == [Path(path) for path in original]


def test_failed_dtc_conversion_does_not_save_reuse_metadata(cached_export, monkeypatch):
    image_path, icc_path, output = cached_export
    manifest_path = output.parent / "manifest.json"
    previous_manifest = manifest_path.read_bytes()
    monkeypatch.setattr(pdf_maker, "convert_pdf_to_pdfx", lambda *_: False)
    monkeypatch.setattr(autofill, "get_ghostscript_path", lambda *_: "test-gs")
    monkeypatch.setattr(autofill, "get_ghostscript_version", lambda _: "test version")
    with pytest.raises(ValueError, match="exactly one PDF/X"):
        autofill.get_dtc_pdf_paths_for_order(make_order(image_path), True, str(icc_path), "LANCZOS")
    assert manifest_path.read_bytes() == previous_manifest


@pytest.mark.parametrize("changed", ["max_dpi", "downscale_alg", "jpeg_quality", "icc", "ghostscript_version"])
def test_dtc_cache_uses_effective_export_options(cached_export, monkeypatch, changed):
    image_path, icc_path, _ = cached_export
    conversions = []
    gs_version = "first version"

    def convert(source, destination, config):
        conversions.append(destination)
        Path(destination).write_bytes(Path(source).read_bytes())
        return True

    monkeypatch.setattr(pdf_maker, "convert_pdf_to_pdfx", convert)
    monkeypatch.setattr(autofill, "get_ghostscript_path", lambda *_: "test-gs")
    monkeypatch.setattr(autofill, "get_ghostscript_version", lambda _: gs_version)
    options = {"max_dpi": 100, "downscale_alg": ImageResizeMethods.LANCZOS, "output_format": "JPEG"}

    def export():
        return autofill.export_pdf_order(
            make_order(image_path),
            True,
            ImagePostProcessingConfig(**options),
            PdfXConversionConfig(icc_profile_path=str(icc_path)),
        )

    export()
    if changed == "icc":
        before = icc_path.stat()
        icc_path.write_bytes(b"modified ICC profile")
        os.utime(icc_path, ns=(before.st_atime_ns, before.st_mtime_ns))
    elif changed == "ghostscript_version":
        gs_version = "second version"
    else:
        options[changed] = {"max_dpi": 150, "downscale_alg": ImageResizeMethods.NEAREST, "jpeg_quality": 75}[changed]
    export()
    assert len(conversions) == 2


def test_image_changed_during_conversion_is_not_cached_as_rendered(cached_export, monkeypatch):
    image_path, icc_path, _ = cached_export
    conversions = []

    def convert(source, destination, config):
        conversions.append(destination)
        Path(destination).write_bytes(Path(source).read_bytes())
        if len(conversions) == 1:
            before = image_path.stat()
            Image.new("RGB", (20, 30), "blue").save(image_path)
            os.utime(image_path, ns=(before.st_atime_ns, before.st_mtime_ns))
        return True

    monkeypatch.setattr(pdf_maker, "convert_pdf_to_pdfx", convert)
    monkeypatch.setattr(autofill, "get_ghostscript_path", lambda *_: "test-gs")
    monkeypatch.setattr(autofill, "get_ghostscript_version", lambda _: "test version")

    def export():
        return autofill.get_dtc_pdf_paths_for_order(make_order(image_path), True, str(icc_path), "LANCZOS")

    export()
    export()
    assert (
        len(conversions) == 2
    ), "PDF rendered before an image edit must not be cached with the edited image's fingerprint"
    export()
    assert len(conversions) == 2
