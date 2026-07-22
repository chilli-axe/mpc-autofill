import gc
import inspect
import logging
import os
import re
import subprocess
import sys
import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from itertools import groupby
from pathlib import Path
from queue import Queue
from types import SimpleNamespace
from typing import Callable, Generator
from xml.etree import ElementTree

import autofill as autofill_cli
import pytest
from click.testing import CliRunner
from enlighten import Counter
from PIL import Image
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

import src
import src.constants as constants
import src.webdrivers as webdrivers
from src.constants import OrderFulfilmentMethod, SourceType
from src.driver import AutofillDriver
from src.exc import ImageDownloadError, ValidationException
from src.formatting import text_to_set
from src.io import get_google_drive_file_name, remove_directories, remove_files
from src.order import (
    CardImage,
    CardImageCollection,
    CardOrder,
    Details,
    aggregate_and_split_orders,
)
from src.pdf_maker import (
    PdfExporter,
    PdfXConversionConfig,
    convert_pdf_to_pdfx,
    get_ghostscript_version,
)
from src.processing import ImagePostProcessingConfig

requires_google_drive_credentials = pytest.mark.skipif(
    not os.path.isfile(os.path.join(os.path.dirname(__file__), "..", "client_secrets.json")),
    reason="Google Drive API credentials (client_secrets.json) are not available",
)

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


def count_pdf_pages(file_path: str) -> int:
    with open(file_path, "rb") as pdf_file:
        return len(re.findall(rb"/Type\s*/Page\b", pdf_file.read()))


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


def test_ensure_ghostscript_available_prompts_until_found(monkeypatch: pytest.MonkeyPatch, input_enter) -> None:
    paths = [None, "/usr/local/bin/gs"]
    called = {"version": 0}

    def fake_get_path():
        return paths.pop(0)

    def fake_get_version(_path: str) -> str:
        called["version"] += 1
        return "10.0.0"

    monkeypatch.setattr(autofill_cli, "get_ghostscript_path", fake_get_path)
    monkeypatch.setattr(autofill_cli, "get_ghostscript_version", fake_get_version)
    monkeypatch.setattr(autofill_cli.click, "confirm", lambda *_args, **_kwargs: False)

    assert autofill_cli.ensure_ghostscript_available() == "/usr/local/bin/gs"
    assert called["version"] == 1


def test_ensure_ghostscript_available_installs_with_winget_on_windows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    paths = [None, "C:\\Program Files\\gs\\gswin64c.exe"]
    install_calls = []

    monkeypatch.setattr(autofill_cli.sys, "platform", "win32", raising=False)
    monkeypatch.setattr(autofill_cli, "get_ghostscript_path", lambda: paths.pop(0))
    monkeypatch.setattr(autofill_cli, "get_ghostscript_version", lambda _path: "10.0.0")
    monkeypatch.setattr(autofill_cli.click, "confirm", lambda *_args, **_kwargs: True)
    monkeypatch.setattr("builtins.input", lambda *_args, **_kwargs: "\n")
    monkeypatch.setattr(
        autofill_cli.shutil,
        "which",
        lambda name: "winget" if name == "winget" else None,
    )

    def fake_run(cmd, check=False):
        install_calls.append(cmd)
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(autofill_cli.subprocess, "run", fake_run)

    resolved = autofill_cli.ensure_ghostscript_available()

    assert resolved == "C:\\Program Files\\gs\\gswin64c.exe"
    assert install_calls == [["winget", "install", "--id", "ArtifexSoftware.Ghostscript", "--accept-source-agreements"]]


def test_ensure_ghostscript_available_installs_with_apt_on_linux(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    paths = [None, "/usr/bin/gs"]
    install_calls = []

    monkeypatch.setattr(autofill_cli.sys, "platform", "linux", raising=False)
    monkeypatch.setattr(autofill_cli, "get_ghostscript_path", lambda: paths.pop(0))
    monkeypatch.setattr(autofill_cli, "get_ghostscript_version", lambda _path: "10.0.0")
    monkeypatch.setattr(autofill_cli.click, "confirm", lambda *_args, **_kwargs: True)
    monkeypatch.setattr("builtins.input", lambda *_args, **_kwargs: "\n")
    monkeypatch.setattr(
        autofill_cli.shutil,
        "which",
        lambda name: "/usr/bin/" + name if name in {"sudo", "apt"} else None,
    )

    def fake_run(cmd, check=False):
        install_calls.append(cmd)
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(autofill_cli.subprocess, "run", fake_run)

    resolved = autofill_cli.ensure_ghostscript_available()

    assert resolved == "/usr/bin/gs"
    assert install_calls == [["sudo", "apt", "install", "-y", "ghostscript"]]


def test_ensure_ghostscript_available_asks_permission_before_installing(monkeypatch: pytest.MonkeyPatch) -> None:
    paths = [None, "/usr/local/bin/gs"]
    asked = {"message": None, "default": None}

    def fake_confirm(message: str, default: bool = True) -> bool:
        asked["message"] = message
        asked["default"] = default
        return True

    monkeypatch.setattr(autofill_cli, "get_ghostscript_path", lambda: paths.pop(0))
    monkeypatch.setattr(autofill_cli, "get_ghostscript_version", lambda _path: "10.0.0")
    monkeypatch.setattr(autofill_cli.click, "confirm", fake_confirm)
    monkeypatch.setattr(autofill_cli, "_install_ghostscript", lambda: None)

    assert autofill_cli.ensure_ghostscript_available() == "/usr/local/bin/gs"
    assert "install Ghostscript now" in asked["message"]
    assert asked["default"] is True


def test_ensure_ghostscript_available_does_not_prompt_when_already_installed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(autofill_cli, "get_ghostscript_path", lambda: "/usr/local/bin/gs")
    monkeypatch.setattr(autofill_cli, "get_ghostscript_version", lambda _path: "10.0.0")
    monkeypatch.setattr(
        autofill_cli.click,
        "confirm",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("should not prompt")),
    )

    assert autofill_cli.ensure_ghostscript_available() == "/usr/local/bin/gs"


def test_maybe_reuse_existing_pdfs_detects_stale_pdfx_even_when_another_pdf_is_newer(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    order_name = "example.xml"
    export_dir = tmp_path / "export" / "example"
    export_dir.mkdir(parents=True)
    cards_dir = tmp_path / "cards"
    cards_dir.mkdir()

    # The PDF/X output is older than the card images, but a plain PDF is newer than both.
    (export_dir / "1_pdfx.pdf").write_bytes(b"pdfx")
    os.utime(export_dir / "1_pdfx.pdf", (1_000, 1_000))
    (cards_dir / "card.jpg").write_bytes(b"jpg")
    os.utime(cards_dir / "card.jpg", (2_000, 2_000))
    (export_dir / "1.pdf").write_bytes(b"pdf")
    os.utime(export_dir / "1.pdf", (3_000, 3_000))

    prompts = {"count": 0}

    def fake_confirm(*_args, **_kwargs) -> bool:
        prompts["count"] += 1
        return True  # recreate the PDF export

    monkeypatch.setattr(autofill_cli.click, "confirm", fake_confirm)

    cwd_before = os.getcwd()
    os.chdir(tmp_path)
    try:
        assert (
            autofill_cli.maybe_reuse_existing_pdfs(
                order_name=order_name,
                skip_pdf_if_exists=True,
                cards_directory=str(cards_dir),
                require_pdfx=True,
            )
            is None
        )
    finally:
        os.chdir(cwd_before)

    assert prompts["count"] == 1


def test_maybe_reuse_existing_pdfs_returns_none_when_skip_disabled(tmp_path) -> None:
    order_name = "example.xml"
    export_dir = tmp_path / "export" / "example"
    export_dir.mkdir(parents=True)
    pdf_path = export_dir / "1.pdf"
    pdf_path.write_bytes(b"pdf")

    cwd_before = os.getcwd()
    os.chdir(tmp_path)
    try:
        assert (
            autofill_cli.maybe_reuse_existing_pdfs(
                order_name=order_name,
                skip_pdf_if_exists=False,
                cards_directory=str(tmp_path / "cards"),
            )
            is None
        )
    finally:
        os.chdir(cwd_before)


def test_maybe_reuse_existing_pdfs_reuses_existing_pdf_when_fresh(tmp_path) -> None:
    order_name = "example.xml"
    export_dir = tmp_path / "export" / "example"
    cards_dir = tmp_path / "cards"
    export_dir.mkdir(parents=True)
    cards_dir.mkdir()

    pdf_path = export_dir / "1.pdf"
    pdf_path.write_bytes(b"pdf")
    card_path = cards_dir / "card.png"
    card_path.write_bytes(b"card")

    now = time.time()
    os.utime(card_path, (now - 20, now - 20))
    os.utime(pdf_path, (now - 10, now - 10))

    cwd_before = os.getcwd()
    os.chdir(tmp_path)
    try:
        reused = autofill_cli.maybe_reuse_existing_pdfs(
            order_name=order_name,
            skip_pdf_if_exists=True,
            cards_directory=str(cards_dir),
        )
        assert reused == [str(pdf_path.relative_to(tmp_path))]
    finally:
        os.chdir(cwd_before)


def test_maybe_reuse_existing_pdfs_recreates_when_cards_newer_and_user_confirms(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    order_name = "example.xml"
    export_dir = tmp_path / "export" / "example"
    cards_dir = tmp_path / "cards"
    export_dir.mkdir(parents=True)
    cards_dir.mkdir()

    pdf_path = export_dir / "1.pdf"
    pdf_path.write_bytes(b"pdf")
    card_path = cards_dir / "card.png"
    card_path.write_bytes(b"card")

    now = time.time()
    os.utime(pdf_path, (now - 20, now - 20))
    os.utime(card_path, (now - 10, now - 10))
    monkeypatch.setattr("autofill.click.confirm", lambda *_args, **_kwargs: True)

    cwd_before = os.getcwd()
    os.chdir(tmp_path)
    try:
        assert (
            autofill_cli.maybe_reuse_existing_pdfs(
                order_name=order_name,
                skip_pdf_if_exists=True,
                cards_directory=str(cards_dir),
            )
            is None
        )
    finally:
        os.chdir(cwd_before)


def test_maybe_reuse_existing_pdfs_keeps_existing_when_cards_newer_and_user_declines(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    order_name = "example.xml"
    export_dir = tmp_path / "export" / "example"
    cards_dir = tmp_path / "cards"
    export_dir.mkdir(parents=True)
    cards_dir.mkdir()

    pdf_path = export_dir / "1.pdf"
    pdf_path.write_bytes(b"pdf")
    card_path = cards_dir / "card.png"
    card_path.write_bytes(b"card")

    now = time.time()
    os.utime(pdf_path, (now - 20, now - 20))
    os.utime(card_path, (now - 10, now - 10))
    monkeypatch.setattr("autofill.click.confirm", lambda *_args, **_kwargs: False)

    cwd_before = os.getcwd()
    os.chdir(tmp_path)
    try:
        reused = autofill_cli.maybe_reuse_existing_pdfs(
            order_name=order_name,
            skip_pdf_if_exists=True,
            cards_directory=str(cards_dir),
        )
        assert reused == [str(pdf_path.relative_to(tmp_path))]
    finally:
        os.chdir(cwd_before)


def test_maybe_reuse_existing_pdfs_requires_pdfx_if_requested(tmp_path) -> None:
    order_name = "example.xml"
    export_dir = tmp_path / "export" / "example"
    export_dir.mkdir(parents=True)
    (export_dir / "1.pdf").write_bytes(b"pdf")

    cwd_before = os.getcwd()
    os.chdir(tmp_path)
    try:
        assert (
            autofill_cli.maybe_reuse_existing_pdfs(
                order_name=order_name,
                skip_pdf_if_exists=True,
                cards_directory=str(tmp_path / "cards"),
                require_pdfx=True,
            )
            is None
        )
    finally:
        os.chdir(cwd_before)


def test_get_undetected_chrome_driver_applies_user_profile_options(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = {"options": None, "version_main": None}

    def fake_chrome(*, options, version_main):
        captured["options"] = options
        captured["version_main"] = version_main
        return object()

    monkeypatch.setattr(webdrivers, "_detect_chrome_version", lambda: 120)
    monkeypatch.setattr("undetected_chromedriver.Chrome", fake_chrome)

    webdrivers.get_undetected_chrome_driver(
        user_data_dir="/tmp/chrome-data",
        profile_directory="Profile 7",
    )

    assert "--user-data-dir=/tmp/chrome-data" in captured["options"].arguments
    assert "--profile-directory=Profile 7" in captured["options"].arguments
    assert captured["version_main"] == 120


@pytest.mark.parametrize("browser", constants.Browsers)
def test_standard_driver_factories_accept_only_upstream_kwargs(browser: constants.Browsers) -> None:
    # Regression test: passing DTC-only kwargs (user_data_dir etc.) to the standard factories
    # used for MakePlayingCards-family sites must fail loudly, proving they were never added there.
    factory_parameters = inspect.signature(browser.value).parameters
    assert set(factory_parameters.keys()) == {"headless", "binary_location"}


def test_cli_help_includes_download_images_only_option() -> None:
    result = CliRunner().invoke(autofill_cli.main, ["--help"])
    assert result.exit_code == 0
    assert "--download-images-only" in result.output


def test_cli_help_includes_global_log_level_option() -> None:
    result = CliRunner().invoke(autofill_cli.main, ["--help"])
    assert result.exit_code == 0
    assert "--log-level" in result.output


def test_cli_help_documents_new_flags() -> None:
    result = CliRunner().invoke(autofill_cli.main, ["--help"])
    assert result.exit_code == 0
    assert "--skip-pdf-if-exists" in result.output
    assert "--download-images-only" in result.output
    assert "--browser-profile-path" in result.output
    assert "--browser-profile-name" in result.output
    assert "--skip-dtc-instructions" in result.output
    assert "detailed Selenium step-by-step logs" in result.output


def test_configure_tls_uses_bundled_certificates_without_overwriting_user_value(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    monkeypatch.delenv("SSL_CERT_FILE", raising=False)
    assert autofill_cli.configure_tls() == autofill_cli.certifi.where()
    assert os.path.isfile(os.environ["SSL_CERT_FILE"])

    custom_bundle = tmp_path / "company-ca.pem"
    custom_bundle.touch()
    monkeypatch.setenv("SSL_CERT_FILE", str(custom_bundle))
    assert autofill_cli.configure_tls() == str(custom_bundle)


def test_startup_defers_heavy_runtime_imports() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import sys, autofill; "
                "heavy=('undetected_chromedriver','fpdf','selenium','googleapiclient','wakepy'); "
                "assert not [name for name in heavy if any(m == name or m.startswith(name + '.') for m in sys.modules)]"
            ),
        ],
        cwd=Path(autofill_cli.__file__).parent,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def test_should_run_interactive_onboarding_only_for_no_argument_tty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(autofill_cli.sys, "argv", ["autofill.py"])
    monkeypatch.setattr(autofill_cli.sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr(autofill_cli.sys.stdout, "isatty", lambda: True)
    assert autofill_cli.should_run_interactive_onboarding()

    monkeypatch.setattr(autofill_cli.sys, "argv", ["autofill.py", "--site", "MakePlayingCards"])
    assert not autofill_cli.should_run_interactive_onboarding()


@pytest.mark.parametrize(
    ("site", "responses", "expected", "prompt_count"),
    [
        (
            "MakePlayingCards",
            ["chrome", "MakePlayingCards", False, True],
            ("chrome", "MakePlayingCards", False, True),
            4,
        ),
        ("DriveThruCards", ["chrome", "DriveThruCards"], ("chrome", "DriveThruCards", True, False), 2),
    ],
)
def test_interactive_onboarding_uses_picker_and_skips_dtc_only_questions(
    monkeypatch: pytest.MonkeyPatch, site: str, responses: list[object], expected: tuple, prompt_count: int
) -> None:
    prompts = []
    answers = iter(responses)

    class Prompt:
        def execute(self):
            return next(answers)

    def fake_rawlist(**kwargs):
        prompts.append(kwargs)
        return Prompt()

    monkeypatch.setattr(autofill_cli.inquirer, "rawlist", fake_rawlist)

    assert autofill_cli.run_interactive_onboarding() == expected
    assert len(prompts) == prompt_count
    assert prompts[1]["choices"][-1] == "DriveThruCards"


def test_dtc_overridden_explicit_flags_are_explained_in_logs(tmp_path, caplog, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("src.logging.configure_loggers", lambda **_kwargs: None)
    monkeypatch.setattr("wakepy.keepawake", lambda **_kwargs: nullcontext())

    with caplog.at_level(logging.INFO, logger="src.logging"):
        # no XML files in tmp_path, so the run exits at the "No XML files found" input() prompt
        result = CliRunner().invoke(
            autofill_cli.main,
            [
                "-d",
                str(tmp_path),
                "--site",
                "DriveThruCards",
                "--image-post-processing",
                "--no-auto-save",
                "--download-images-only",
            ],
            input="\n",
        )

    assert result.exit_code == 0
    assert "Ignoring --image-post-processing" in caplog.text
    assert "Ignoring --no-auto-save" in caplog.text


def test_cli_site_choices_list_drivethrucards_last() -> None:
    result = CliRunner().invoke(autofill_cli.main, ["--help"])
    assert result.exit_code == 0
    site_line = next(line for line in result.output.splitlines() if line.strip().startswith("--site ["))
    assert site_line.endswith("DriveThruCards]")


def test_main_drive_thru_cards_exportpdf_generates_pdfs_without_browser_automation(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    icc_path = tmp_path / "test.icc"
    icc_path.write_bytes(b"icc")
    browser_path = tmp_path / "chrome.exe"
    browser_path.touch()

    calls = {"pdf": [], "wait": 0, "driver": 0}

    monkeypatch.setattr("src.logging.configure_loggers", lambda **_kwargs: None)
    monkeypatch.setattr("wakepy.keepawake", lambda **_kwargs: nullcontext())
    monkeypatch.setattr(autofill_cli, "get_ghostscript_path", lambda: "/opt/homebrew/bin/gs")
    monkeypatch.setattr(autofill_cli, "ensure_ghostscript_available", lambda **_kwargs: "/opt/homebrew/bin/gs")
    monkeypatch.setattr("src.icc.find_or_download_dtc_icc_profile", lambda: str(icc_path))
    monkeypatch.setattr(
        CardOrder,
        "from_xmls_in_folder",
        lambda working_directory: [SimpleNamespace(name="test_local")],
    )

    def fake_get_dtc_pdf_paths_for_order(**kwargs):
        calls["pdf"].append(kwargs["order"].name)
        return ["export/test_local/1.pdf", "export/test_local/1_pdfx.pdf"]

    monkeypatch.setattr(autofill_cli, "get_dtc_pdf_paths_for_order", fake_get_dtc_pdf_paths_for_order)
    monkeypatch.setattr(autofill_cli, "wait_for_user_to_complete_order", lambda: calls.__setitem__("wait", 1))

    class ShouldNotInstantiateDriver:
        def __init__(self, *args, **kwargs) -> None:
            calls["driver"] += 1
            raise AssertionError("DriveThruCards browser automation should not run during --exportpdf")

    monkeypatch.setattr("src.driver.AutofillDriver", ShouldNotInstantiateDriver)

    result = CliRunner().invoke(
        autofill_cli.main,
        [
            "--directory",
            str(tmp_path),
            "--site",
            constants.TargetSites.DriveThruCards.name,
            "--exportpdf",
            "--browser",
            constants.Browsers.chrome.name,
            "--binary-location",
            str(browser_path),
        ],
    )

    assert result.exit_code == 0
    assert calls["pdf"] == ["test_local"]
    assert calls["wait"] == 0
    assert calls["driver"] == 0


@pytest.mark.parametrize(
    ("skip_instructions", "expected_starting_url", "expected_server_count"),
    [
        (False, "http://localhost:1234/", 1),
        (True, constants.TargetSites.DriveThruCards.value.starting_url, 0),
    ],
)
def test_main_drive_thru_cards_keeps_driver_alive_until_user_handoff(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
    skip_instructions: bool,
    expected_starting_url: str,
    expected_server_count: int,
) -> None:
    icc_path = tmp_path / "test.icc"
    icc_path.write_bytes(b"icc")

    state = {"finalized": 0, "executed": 0, "wait_seen": None, "servers": 0, "starting_url": None}

    monkeypatch.setattr("src.logging.configure_loggers", lambda **_kwargs: None)
    monkeypatch.setattr("wakepy.keepawake", lambda **_kwargs: nullcontext())
    monkeypatch.setattr(autofill_cli, "get_ghostscript_path", lambda: "/opt/homebrew/bin/gs")
    monkeypatch.setattr(autofill_cli, "ensure_ghostscript_available", lambda **_kwargs: "/opt/homebrew/bin/gs")
    monkeypatch.setattr("src.icc.find_or_download_dtc_icc_profile", lambda: str(icc_path))
    monkeypatch.setattr(
        CardOrder,
        "from_xmls_in_folder",
        lambda working_directory: [SimpleNamespace(name="test_local")],
    )
    monkeypatch.setattr(
        autofill_cli,
        "get_dtc_pdf_paths_for_order",
        lambda **_kwargs: ["export/test_local/1.pdf", "export/test_local/1_pdfx.pdf"],
    )

    class FakeWebServer:
        def __init__(self, html_filename: str) -> None:
            assert html_filename == constants.DTC_POST_LAUNCH_HTML_FILENAME
            state["servers"] += 1

        def server_url(self) -> str:
            return "http://localhost:1234/"

    monkeypatch.setattr("src.web_server.WebServer", FakeWebServer)

    class FakeDriver:
        def __init__(self, *args, **kwargs) -> None:
            state["starting_url"] = kwargs["starting_url"]

        def execute_drive_thru_cards_order(self, order, pdf_path) -> None:
            state["executed"] += 1

        def __del__(self) -> None:
            state["finalized"] += 1

    monkeypatch.setattr("src.driver.AutofillDriver", FakeDriver)

    def fake_wait_for_user_to_complete_order() -> None:
        gc.collect()
        state["wait_seen"] = state["finalized"]

    monkeypatch.setattr(autofill_cli, "wait_for_user_to_complete_order", fake_wait_for_user_to_complete_order)

    args = [
        "--directory",
        str(tmp_path),
        "--site",
        constants.TargetSites.DriveThruCards.name,
        "--browser",
        constants.Browsers.chrome.name,
    ]
    if skip_instructions:
        args.append("--skip-dtc-instructions")

    result = CliRunner().invoke(autofill_cli.main, args)

    gc.collect()

    assert result.exit_code == 0
    assert state["executed"] == 1
    assert state["wait_seen"] == 0
    assert state["finalized"] == 1
    assert state["servers"] == expected_server_count
    assert state["starting_url"] == expected_starting_url


def test_download_images_for_orders_downloads_fronts_and_backs() -> None:
    calls = {"fronts": 0, "backs": 0}

    class Face:
        def __init__(self, key: str) -> None:
            self._key = key
            self.cards_by_id = {"a": object()}

        def download_images(self, _pool, _download_bar, _post_processing_config):
            calls[self._key] += 1

    order = SimpleNamespace(name="order1", fronts=Face("fronts"), backs=Face("backs"), get_failed_downloads=lambda: [])

    autofill_cli.download_images_for_orders(orders=[order], post_processing_config=DEFAULT_POST_PROCESSING)

    assert calls["fronts"] == 1
    assert calls["backs"] == 1


def test_nuitka_directives_include_runtime_data_and_cached_extraction() -> None:
    with open(autofill_cli.__file__, "r", encoding="utf-8") as f:
        source = f.read()
    assert "--include-data-dir=assets=assets" in source
    assert "--include-package-data=certifi" in source
    assert "--onefile-tempdir-spec={CACHE_DIR}/mpc-autofill/{VERSION}" in source


def test_readme_points_users_to_wiki_for_usage_docs() -> None:
    readme_path = os.path.join(os.path.dirname(autofill_cli.__file__), "readme.md")
    with open(readme_path, "r", encoding="utf-8") as f:
        readme = f.read()
    assert "https://github.com/chilli-axe/mpc-autofill/wiki/Desktop-Tool" in readme
    assert "--skip-pdf-if-exists" not in readme
    assert "--download-images-only" not in readme


# endregion

# region ICC profile resolution


def test_find_or_download_dtc_icc_profile_prefers_installed_copy(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    installed_profile = tmp_path / "USWebCoatedSWOP.icc"
    installed_profile.write_bytes(b"icc")
    monkeypatch.setattr(src.icc, "_candidate_profile_paths", lambda: [tmp_path / "missing.icc", installed_profile])
    monkeypatch.setattr(
        src.icc.requests, "get", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("no download"))
    )

    assert src.icc.find_or_download_dtc_icc_profile() == str(installed_profile)


def test_find_or_download_dtc_icc_profile_returns_none_when_download_declined(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    monkeypatch.setattr(src.icc, "_candidate_profile_paths", lambda: [tmp_path / "missing.icc"])
    monkeypatch.setattr(src.icc.click, "confirm", lambda *_args, **_kwargs: False)

    assert src.icc.find_or_download_dtc_icc_profile() is None


def _fake_adobe_bundle_response(profile_bytes: bytes) -> SimpleNamespace:
    import io as io_module
    import zipfile

    buffer = io_module.BytesIO()
    with zipfile.ZipFile(buffer, "w") as bundle:
        bundle.writestr(src.icc.ADOBE_ICC_BUNDLE_MEMBER, profile_bytes)
    return SimpleNamespace(content=buffer.getvalue(), raise_for_status=lambda: None)


def test_find_or_download_dtc_icc_profile_downloads_and_caches(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    import hashlib

    profile_bytes = b"fake icc profile"
    monkeypatch.setattr(src.icc, "_candidate_profile_paths", lambda: [tmp_path / "missing.icc"])
    monkeypatch.setattr(src.icc, "get_profile_cache_path", lambda: tmp_path / "cache" / "USWebCoatedSWOP.icc")
    monkeypatch.setattr(src.icc.click, "confirm", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(src.icc, "ICC_PROFILE_SHA256", hashlib.sha256(profile_bytes).hexdigest())
    monkeypatch.setattr(src.icc.requests, "get", lambda *_args, **_kwargs: _fake_adobe_bundle_response(profile_bytes))

    resolved = src.icc.find_or_download_dtc_icc_profile()

    assert resolved == str(tmp_path / "cache" / "USWebCoatedSWOP.icc")
    assert (tmp_path / "cache" / "USWebCoatedSWOP.icc").read_bytes() == profile_bytes


def test_find_or_download_dtc_icc_profile_rejects_checksum_mismatch(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    monkeypatch.setattr(src.icc, "_candidate_profile_paths", lambda: [tmp_path / "missing.icc"])
    monkeypatch.setattr(src.icc, "get_profile_cache_path", lambda: tmp_path / "cache" / "USWebCoatedSWOP.icc")
    monkeypatch.setattr(src.icc.click, "confirm", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(src.icc.requests, "get", lambda *_args, **_kwargs: _fake_adobe_bundle_response(b"tampered"))

    assert src.icc.find_or_download_dtc_icc_profile() is None
    assert not (tmp_path / "cache" / "USWebCoatedSWOP.icc").exists()


# endregion

# region PDF/X conversion


def test_convert_pdf_to_pdfx_writes_output_atomically(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    source_path = tmp_path / "source.pdf"
    output_path = tmp_path / "output.pdf"
    source_path.write_bytes(b"source")

    def fake_run(cmd, capture_output=True, text=True):
        output_arg = next(arg for arg in cmd if arg.startswith("-sOutputFile="))
        Path(output_arg.split("=", 1)[1]).write_bytes(b"%PDF-1.3 (PDF/X-1a:2001) /OutputIntents")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr("src.pdf_maker.get_ghostscript_path", lambda _path=None: "/opt/homebrew/bin/gs")
    monkeypatch.setattr("src.pdf_maker.subprocess.run", fake_run)

    assert convert_pdf_to_pdfx(
        str(source_path),
        str(output_path),
        PdfXConversionConfig(icc_profile_path="dummy.icc"),
    )
    assert output_path.read_bytes() == b"%PDF-1.3 (PDF/X-1a:2001) /OutputIntents"
    assert sorted(path.name for path in tmp_path.iterdir()) == ["output.pdf", "source.pdf"]


def test_convert_pdf_to_pdfx_does_not_leave_partial_output_on_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    source_path = tmp_path / "source.pdf"
    output_path = tmp_path / "output.pdf"
    source_path.write_bytes(b"source")
    output_path.write_bytes(b"previous")

    def fake_run(cmd, capture_output=True, text=True):
        output_arg = next(arg for arg in cmd if arg.startswith("-sOutputFile="))
        Path(output_arg.split("=", 1)[1]).write_bytes(b"partial")
        return SimpleNamespace(returncode=1, stdout="bad", stderr="worse")

    monkeypatch.setattr("src.pdf_maker.get_ghostscript_path", lambda _path=None: "/opt/homebrew/bin/gs")
    monkeypatch.setattr("src.pdf_maker.subprocess.run", fake_run)

    assert not convert_pdf_to_pdfx(
        str(source_path),
        str(output_path),
        PdfXConversionConfig(icc_profile_path="dummy.icc"),
    )
    assert output_path.read_bytes() == b"previous"
    assert sorted(path.name for path in tmp_path.iterdir()) == ["output.pdf", "source.pdf"]


def test_convert_pdf_to_pdfx_rejects_output_missing_pdfx_markers(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    source_path = tmp_path / "source.pdf"
    output_path = tmp_path / "output.pdf"
    source_path.write_bytes(b"source")
    output_path.write_bytes(b"previous")

    def fake_run(cmd, capture_output=True, text=True):
        # Zero exit code, but the output is a plain PDF rather than PDF/X-1a.
        output_arg = next(arg for arg in cmd if arg.startswith("-sOutputFile="))
        Path(output_arg.split("=", 1)[1]).write_bytes(b"%PDF-1.3 plain")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr("src.pdf_maker.get_ghostscript_path", lambda _path=None: "/opt/homebrew/bin/gs")
    monkeypatch.setattr("src.pdf_maker.subprocess.run", fake_run)

    assert not convert_pdf_to_pdfx(
        str(source_path),
        str(output_path),
        PdfXConversionConfig(icc_profile_path="dummy.icc"),
    )
    assert output_path.read_bytes() == b"previous"


@pytest.mark.skipif(src.pdf_maker.get_ghostscript_path() is None, reason="Ghostscript is not installed")
def test_convert_pdf_to_pdfx_produces_verified_pdfx_with_real_ghostscript(tmp_path) -> None:
    from fpdf import FPDF

    image_path = tmp_path / "card.jpg"
    Image.new("RGB", (819, 1113), (200, 30, 40)).save(image_path, "JPEG")
    pdf = FPDF("P", "in", (2.73, 3.71))
    pdf.add_page()
    pdf.image(str(image_path), x=0, y=0, w=2.73, h=3.71)
    source_path = tmp_path / "source.pdf"
    pdf.output(str(source_path))
    output_path = tmp_path / "output_pdfx.pdf"

    assert convert_pdf_to_pdfx(str(source_path), str(output_path), PdfXConversionConfig())

    contents = output_path.read_bytes()
    assert b"(PDF/X-1:2001)" in contents  # GTS_PDFXVersion
    assert b"(PDF/X-1a:2001)" in contents  # GTS_PDFXConformance
    assert b"/OutputIntents" in contents
    assert b"CGATS TR 001" in contents


@requires_google_drive_credentials
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
        pdfx_config=PdfXConversionConfig(icc_profile_path="dummy.icc"),
    )
    generated_files = pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    expected_pdfx_files = [
        Path("export/test_order/1_pdfx.pdf"),
        Path("export/test_order/2_pdfx.pdf"),
        Path("export/test_order/3_pdfx.pdf"),
    ]
    for file_path in expected_pdfx_files:
        assert file_path in map(Path, generated_files)
        assert os.path.exists(file_path)

    remove_files([path for path in generated_files if path.endswith(".pdf")])
    remove_directories(["export/test_order", "export"])


@requires_google_drive_credentials
def test_pdf_exporter_skips_pdfx_on_failure(monkeypatch: pytest.MonkeyPatch, card_order_valid) -> None:
    def do_nothing(_):
        return None

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    monkeypatch.setattr("src.pdf_maker.convert_pdf_to_pdfx", lambda *_args, **_kwargs: False)

    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(
        order=card_order_valid,
        number_of_cards_per_file=1,
        pdfx_config=PdfXConversionConfig(icc_profile_path="dummy.icc"),
    )
    generated_files = pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    assert not any(path.endswith("_pdfx.pdf") for path in generated_files)

    remove_files([path for path in generated_files if path.endswith(".pdf")])
    remove_directories(["export/test_order", "export"])


@requires_google_drive_credentials
def test_pdf_exporter_logs_pdfx_conversion_progress(monkeypatch: pytest.MonkeyPatch, card_order_valid) -> None:
    logged_messages = []

    def do_nothing(_):
        return None

    def fake_info(message: str):
        logged_messages.append(message)

    def fake_convert_pdf_to_pdfx(source_path: str, output_path: str, _config) -> bool:
        with open(output_path, "wb") as f:
            f.write(b"pdfx")
        return True

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    monkeypatch.setattr("src.pdf_maker.convert_pdf_to_pdfx", fake_convert_pdf_to_pdfx)
    monkeypatch.setattr("src.pdf_maker.logger.info", fake_info)

    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(
        order=card_order_valid,
        number_of_cards_per_file=1,
        pdfx_config=PdfXConversionConfig(icc_profile_path="dummy.icc"),
    )
    generated_files = pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    progress_logs = [message for message in logged_messages if message.startswith("Converting PDF to PDF/X-1a")]
    assert len(progress_logs) == 3
    assert Path(progress_logs[0].rsplit(": ", 1)[1]) == Path("export/test_order/1.pdf")

    remove_files([path for path in generated_files if path.endswith(".pdf")])
    remove_directories(["export/test_order", "export"])


def test_pdf_exporter_add_image_uses_image_bytes(monkeypatch: pytest.MonkeyPatch, card_order_valid, tmp_path) -> None:
    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", lambda _self: None)
    pdf_exporter = PdfExporter(order=card_order_valid, number_of_cards_per_file=1)
    pdf_exporter.generate_pdf()

    image_path = tmp_path / "sample.png"
    Image.new("RGB", (4, 4), "red").save(image_path)

    captured_name = {"value": None}

    def fake_image(name, **_kwargs):
        captured_name["value"] = name

    monkeypatch.setattr(pdf_exporter.pdf, "image", fake_image)

    pdf_exporter.add_image(str(image_path))

    assert isinstance(captured_name["value"], bytes)


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


@requires_google_drive_credentials
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


@requires_google_drive_credentials
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


@requires_google_drive_credentials
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


@requires_google_drive_credentials
def test_download_google_drive_image_no_post_processing(
    image_valid_google_drive: CardImage, counter: Counter, queue: Queue[CardImage]
):
    image_valid_google_drive.download_image(download_bar=counter, queue=queue, post_processing_config=None)
    assert image_valid_google_drive.file_exists() is True
    assert image_valid_google_drive.errored is False
    assert_file_size(image_valid_google_drive.file_path, 155686)


@requires_google_drive_credentials
def test_invalid_google_drive_image(image_invalid_google_drive: CardImage, counter: Counter, queue: Queue[CardImage]):
    image_invalid_google_drive.download_image(
        download_bar=counter, queue=queue, post_processing_config=DEFAULT_POST_PROCESSING
    )
    assert image_invalid_google_drive.errored is True


def test_failed_image_summary_is_logged_with_name_slots_and_link(monkeypatch, tmp_path, caplog):
    image = CardImage(
        drive_id="missing-drive-id",
        slots={2, 5},
        name="Missing Card.png",
        file_path=str(tmp_path / "Missing Card.png"),
    )
    monkeypatch.setattr("src.order.download_google_drive_file", lambda **_kwargs: False)
    progress = SimpleNamespace(update=lambda: None, refresh=lambda: None)

    with caplog.at_level(logging.ERROR, logger="src.logging"):
        image.download_image(queue=Queue(), download_bar=progress, post_processing_config=None)

    message = caplog.text
    assert "Missing Card.png" in message
    assert "[2, 5]" in message
    assert "missing-drive-id" in message


@requires_google_drive_credentials
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


@requires_google_drive_credentials
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


@requires_google_drive_credentials
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


@requires_google_drive_credentials
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


@requires_google_drive_credentials
def test_pdf_export_complete_3_cards_single_file(monkeypatch, card_order_valid):
    def do_nothing(_):
        return None

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(order=card_order_valid)
    pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    assert pdf_exporter.processed_bar.total == 3
    assert pdf_exporter.processed_bar.count == 3

    expected_generated_files = [
        "export/test_order/1.pdf",
    ]

    for file_path in expected_generated_files:
        assert os.path.exists(file_path)
    remove_files(expected_generated_files)
    remove_directories(["export/test_order", "export"])


@requires_google_drive_credentials
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


@requires_google_drive_credentials
def test_pdf_export_complete_separate_faces(monkeypatch, card_order_valid):
    def do_nothing(_):
        return None

    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", do_nothing)
    card_order_valid.name = "test_order.xml"
    pdf_exporter = PdfExporter(order=card_order_valid, separate_faces=True, number_of_cards_per_file=1)
    pdf_exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    assert pdf_exporter.processed_bar.total == 3
    assert pdf_exporter.processed_bar.count == 3

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


def test_pdf_export_stops_before_creating_pdf_when_an_image_download_fails(monkeypatch, card_order_valid):
    monkeypatch.setattr("src.pdf_maker.PdfExporter.ask_questions", lambda _self: None)

    def download_fronts(*_args):
        for index, card in enumerate(card_order_valid.fronts.cards_by_id.values()):
            card.downloaded = index != 0

    def download_backs(*_args):
        for card in card_order_valid.backs.cards_by_id.values():
            card.downloaded = True

    monkeypatch.setattr(card_order_valid.fronts, "download_images", download_fronts)
    monkeypatch.setattr(card_order_valid.backs, "download_images", download_backs)
    exporter = PdfExporter(order=card_order_valid)
    monkeypatch.setattr(exporter, "export", lambda: pytest.fail("PDF export should not start"))
    manager_stop_calls = []
    monkeypatch.setattr(exporter.manager, "stop", lambda: manager_stop_calls.append(True))

    with pytest.raises(ImageDownloadError, match="Import this XML into a new project at"):
        exporter.execute(post_processing_config=DEFAULT_POST_PROCESSING)

    assert exporter.saved_files == []
    # the terminal rows must be released even when the export aborts
    assert manager_stop_calls == [True]


def test_pdf_export_drive_thru_cards_combines_actual_front_slots_into_one_file(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    for image_name, color in [("front_a.png", "red"), ("front_b.png", "blue"), ("back.png", "black")]:
        Image.new("RGB", (300, 420), color).save(tmp_path / image_name)

    order = CardOrder.from_element(
        working_directory=str(tmp_path),
        element=ElementTree.fromstring(
            textwrap.dedent(
                f"""
                <order>
                    <details>
                        <quantity>1</quantity>
                        <stock>(S30) Standard Smooth</stock>
                        <foil>false</foil>
                    </details>
                    <fronts>
                        <card>
                            <id>{tmp_path / "front_a.png"}</id>
                            <sourceType>{SourceType.LOCAL_FILE}</sourceType>
                            <slots>0</slots>
                            <name>front_a.png</name>
                        </card>
                        <card>
                            <id>{tmp_path / "front_b.png"}</id>
                            <sourceType>{SourceType.LOCAL_FILE}</sourceType>
                            <slots>1</slots>
                            <name>front_b.png</name>
                        </card>
                    </fronts>
                    <backs></backs>
                    <cardback>{tmp_path / "back.png"}</cardback>
                </order>
                """
            )
        ),
        allowed_to_exceed_project_max_size=True,
    )
    order.name = "test_local.xml"

    exporter = PdfExporter(order=order, export_mode="drive_thru_cards")
    manager_stop_calls = []
    monkeypatch.setattr(exporter.manager, "stop", lambda: manager_stop_calls.append(True))
    generated_files = exporter.execute(
        post_processing_config=ImagePostProcessingConfig(
            max_dpi=300,
            downscale_alg=constants.ImageResizeMethods.LANCZOS,
            output_format="JPEG",
            convert_to_cmyk=False,
        )
    )

    assert list(map(Path, generated_files)) == [Path("export/test_local/1.pdf")]
    assert os.path.exists("export/test_local/1.pdf")
    assert count_pdf_pages("export/test_local/1.pdf") == 4
    # progress bars are frozen into scrollback once the export completes
    assert manager_stop_calls == [True]


def test_pdf_export_drive_thru_cards_processes_and_embeds_repeated_images_once(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    for image_name, color in [("front_a.png", "red"), ("front_b.png", "blue"), ("back.png", "black")]:
        Image.new("RGB", (300, 420), color).save(tmp_path / image_name)

    process_calls: list[None] = []
    real_post_process_image = src.pdf_maker.post_process_image

    def counting_post_process_image(raw_image, config):
        process_calls.append(None)
        return real_post_process_image(raw_image=raw_image, config=config)

    monkeypatch.setattr("src.pdf_maker.post_process_image", counting_post_process_image)

    order = CardOrder.from_element(
        working_directory=str(tmp_path),
        element=ElementTree.fromstring(
            textwrap.dedent(
                f"""
                <order>
                    <details>
                        <quantity>1</quantity>
                        <stock>(S30) Standard Smooth</stock>
                        <foil>false</foil>
                    </details>
                    <fronts>
                        <card>
                            <id>{tmp_path / "front_a.png"}</id>
                            <sourceType>{SourceType.LOCAL_FILE}</sourceType>
                            <slots>0</slots>
                            <name>front_a.png</name>
                        </card>
                        <card>
                            <id>{tmp_path / "front_b.png"}</id>
                            <sourceType>{SourceType.LOCAL_FILE}</sourceType>
                            <slots>1</slots>
                            <name>front_b.png</name>
                        </card>
                    </fronts>
                    <backs></backs>
                    <cardback>{tmp_path / "back.png"}</cardback>
                </order>
                """
            )
        ),
        allowed_to_exceed_project_max_size=True,
    )
    order.name = "test_dedup.xml"

    exporter = PdfExporter(order=order, export_mode="drive_thru_cards")
    exporter.execute(
        post_processing_config=ImagePostProcessingConfig(
            max_dpi=300,
            downscale_alg=constants.ImageResizeMethods.LANCZOS,
            output_format="JPEG",
            convert_to_cmyk=False,
        )
    )

    # 4 pages (back, front_a, back, front_b) but only 3 unique images: the shared
    # cardback must be post-processed once and its JPEG data embedded once.
    assert count_pdf_pages("export/test_dedup/1.pdf") == 4
    assert len(process_calls) == 3
    with open("export/test_dedup/1.pdf", "rb") as f:
        assert f.read().count(b"DCTDecode") == 3
    # temp files are cleaned up after execute()
    assert exporter.processed_image_paths == {}


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
@requires_google_drive_credentials
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


def test_console_formatter_hides_tracebacks_but_default_formatter_keeps_them():
    from src.logging import ConsoleFormatter

    try:
        raise ValueError("boom")
    except ValueError:
        record = logging.LogRecord(
            name="src.logging",
            level=logging.ERROR,
            pathname=__file__,
            lineno=1,
            msg="download failed",
            args=(),
            exc_info=sys.exc_info(),
        )

    assert ConsoleFormatter().format(record) == "download failed"
    # the record itself is untouched, so the crash log formatter still sees the traceback
    assert "Traceback" in logging.Formatter().format(record)


def test_execute_order_stops_before_upload_when_downloads_fail(monkeypatch, card_order_valid):
    monkeypatch.setattr(AutofillDriver, "__attrs_post_init__", lambda self: None)
    driver = AutofillDriver(target_site=constants.TargetSites.MakePlayingCards)
    driver.initialise_bars()

    def fail_fronts(**_kwargs):
        for index, card in enumerate(card_order_valid.fronts.cards_by_id.values()):
            card.downloaded = index != 0

    def download_backs(**_kwargs):
        for card in card_order_valid.backs.cards_by_id.values():
            card.downloaded = True

    monkeypatch.setattr(card_order_valid.fronts, "download_images", fail_fronts)
    monkeypatch.setattr(card_order_valid.backs, "download_images", download_backs)
    monkeypatch.setattr(driver, "initialise_order", lambda **_kwargs: pytest.fail("upload must not start"))

    with pytest.raises(ImageDownloadError, match="stopped before creating your order"):
        driver.execute_order(
            order=card_order_valid,
            fulfilment_method=OrderFulfilmentMethod.new_project,
            auto_save_threshold=None,
            post_processing_config=None,
        )


def test_prune_stale_onefile_caches_removes_only_sibling_version_dirs(tmp_path):
    cache_root = tmp_path / "mpc-autofill"
    current = cache_root / "1.0.2"
    stale = cache_root / "1.0.1"
    for directory in (current, stale):
        directory.mkdir(parents=True)
        (directory / "autofill.bin").touch()
    (cache_root / "unrelated-file.txt").touch()

    autofill_cli.prune_stale_onefile_caches(str(current))

    assert current.exists()
    assert not stale.exists()
    assert (cache_root / "unrelated-file.txt").exists()

    # refuses to delete anything when not inside an mpc-autofill cache directory
    other = tmp_path / "somewhere-else" / "1.0.2"
    other_sibling = tmp_path / "somewhere-else" / "1.0.1"
    other.mkdir(parents=True)
    other_sibling.mkdir(parents=True)
    autofill_cli.prune_stale_onefile_caches(str(other))
    assert other_sibling.exists()


def test_console_filter_hides_file_only_records():
    from src.logging import FILE_ONLY, _console_visible

    visible = logging.LogRecord(
        name="src.logging", level=logging.ERROR, pathname=__file__, lineno=1, msg="shown", args=(), exc_info=None
    )
    hidden = logging.LogRecord(
        name="src.logging", level=logging.ERROR, pathname=__file__, lineno=1, msg="hidden", args=(), exc_info=None
    )
    for key, value in FILE_ONLY.items():
        setattr(hidden, key, value)

    assert _console_visible(visible) is True
    assert _console_visible(hidden) is False


def test_download_images_only_raises_summary_when_downloads_fail(monkeypatch, card_order_valid):
    def fail_fronts(*_args, **_kwargs):
        for card in card_order_valid.fronts.cards_by_id.values():
            card.downloaded = False

    def download_backs(*_args, **_kwargs):
        for card in card_order_valid.backs.cards_by_id.values():
            card.downloaded = True

    monkeypatch.setattr(card_order_valid.fronts, "download_images", fail_fronts)
    monkeypatch.setattr(card_order_valid.backs, "download_images", download_backs)

    with pytest.raises(ImageDownloadError, match="stopped before creating your order"):
        autofill_cli.download_images_for_orders(orders=[card_order_valid], post_processing_config=None)
