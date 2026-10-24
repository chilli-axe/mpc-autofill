"""Reuse PDF exports only while their inputs and output bytes still match."""

import hashlib
import json
import os
import tempfile
from importlib.metadata import version
from pathlib import Path
from typing import Optional

import attr

from src.logging import logger
from src.order import CardOrder
from src.pdf_maker import get_export_directory


def _file_hash(path: Path) -> str:
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def fingerprint_pdf_inputs(order: CardOrder, extra_paths: list[str]) -> str:
    images = {
        str(Path(card.file_path).resolve())
        for face in (order.fronts, order.backs)
        for card in face.cards_by_id.values()
        if card.file_path
    }
    data = {
        "version": 3,  # Bump when PDF export behavior changes without a settings change.
        "order": attr.asdict(
            order,
            filter=lambda field, _value: field.name not in {"downloaded", "uploaded", "errored", "pid", "queue"},
        ),
        "renderers": [version("fpdf2"), version("pillow")],
        "files": {path: _file_hash(Path(path)) for path in sorted(images | set(extra_paths))},
    }
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=sorted).encode()).hexdigest()


def reuse_pdf_export(order: CardOrder, settings: str, extra_paths: list[str]) -> Optional[list[str]]:
    directory = Path(get_export_directory(order.name))
    try:
        manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
        if manifest["settings"] != settings or manifest["fingerprint"] != fingerprint_pdf_inputs(order, extra_paths):
            return None
        outputs = manifest["outputs"]
        if not isinstance(outputs, dict) or not outputs:
            return None
        paths = []
        for relative_path, digest in outputs.items():
            path = directory / relative_path
            if not path.resolve().is_relative_to(directory.resolve()) or path.suffix != ".pdf":
                return None
            if _file_hash(path) != digest:
                return None
            paths.append(str(path))
        logger.info("Reusing PDF export: order, images, settings and PDF contents match.")
        return paths
    except OSError, ValueError, TypeError, KeyError:
        return None


def save_pdf_export(
    order: CardOrder,
    settings: str,
    extra_paths: list[str],
    paths: list[str],
    expected_fingerprint: Optional[str] = None,
) -> None:
    directory = Path(get_export_directory(order.name))
    temporary_path = None
    try:
        fingerprint = fingerprint_pdf_inputs(order, extra_paths)
        if expected_fingerprint is not None and fingerprint != expected_fingerprint:
            logger.warning("Inputs changed during PDF export. This export will not be reused.")
            return
        manifest = {
            "fingerprint": fingerprint,
            "settings": settings,
            "outputs": {
                str(Path(path).resolve().relative_to(directory.resolve())): _file_hash(Path(path)) for path in paths
            },
        }
        with tempfile.NamedTemporaryFile("w", dir=directory, encoding="utf-8", delete=False) as file:
            temporary_path = file.name
            json.dump(manifest, file)
        os.replace(temporary_path, directory / "manifest.json")
    except OSError, ValueError:
        logger.warning("PDF export succeeded, but its reuse metadata could not be saved.")
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)
