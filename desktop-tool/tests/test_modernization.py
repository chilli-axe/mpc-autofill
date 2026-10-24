import json
import logging
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from click.testing import CliRunner
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from google_auth_httplib2 import AuthorizedHttp
from wakepy import ActivationWarning, keep

from src import io, pdf_maker
from src.order import CardOrder

import autofill


def test_service_account_signing_transport_and_thread_local_reuse(monkeypatch, tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    credential_path = tmp_path / "synthetic-service-account.json"
    credential_path.write_text(
        json.dumps(
            {
                "type": "service_account",
                "client_email": "test@synthetic.iam.gserviceaccount.com",
                "token_uri": "https://oauth2.googleapis.com/token",
                "private_key": key.private_bytes(
                    serialization.Encoding.PEM,
                    serialization.PrivateFormat.PKCS8,
                    serialization.NoEncryption(),
                ).decode(),
            }
        )
    )
    monkeypatch.setattr(io.constants, "SERVICE_ACC_FILENAME", str(credential_path))
    monkeypatch.setattr(io, "thread_local", threading.local())
    credentials = []

    def build(api, version, **kwargs):
        assert (api, version) == ("drive", "v3")
        assert kwargs["static_discovery"] is False
        assert kwargs["cache_discovery"] is False
        creds = kwargs["credentials"]
        assert creds.scopes == io.constants.SCOPES
        key.public_key().verify(
            creds.sign_bytes(b"offline check"), b"offline check", padding.PKCS1v15(), hashes.SHA256()
        )
        assert AuthorizedHttp(creds).credentials is creds
        credentials.append(creds)
        return object()

    monkeypatch.setattr(io, "build", build)
    barrier = threading.Barrier(2)

    def in_thread():
        service = io.find_or_create_google_drive_service()
        barrier.wait(timeout=10)
        assert io.find_or_create_google_drive_service() is service
        return service

    with ThreadPoolExecutor(max_workers=2) as pool:
        a, b = list(pool.map(lambda _: in_thread(), range(2)))
    assert a is not b
    assert len(credentials) == 2


@pytest.mark.parametrize(
    "active,allowsleep,fail", [(True, False, False), (False, False, False), (True, True, False), (True, False, True)]
)
def test_sleep_context_uses_real_mode_and_releases_on_failure(monkeypatch, tmp_path, caplog, active, allowsleep, fail):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("src.logging.configure_loggers", lambda **_: None)
    monkeypatch.setattr(CardOrder, "from_xmls_in_folder", lambda **_: [])
    monkeypatch.setattr(
        autofill,
        "download_images_for_orders",
        lambda **_: (_ for _ in ()).throw(RuntimeError("test")) if fail else None,
    )
    original_presenting = keep.presenting
    modes = []
    if active:
        monkeypatch.setenv("WAKEPY_FAKE_SUCCESS", "1")
    else:
        monkeypatch.delenv("WAKEPY_FAKE_SUCCESS", raising=False)

    def presenting(**kwargs):
        assert not allowsleep, "--allowsleep must bypass mode construction"
        mode = original_presenting(methods=[], **kwargs)
        modes.append(mode)
        return mode

    monkeypatch.setattr(keep, "presenting", presenting)
    args = ["--directory", str(tmp_path), "--site", "DriveThruCards", "--download-images-only"]
    if allowsleep:
        args.append("--allowsleep")
    with caplog.at_level(logging.INFO, logger="src.logging"):
        if not active and not allowsleep:
            with pytest.warns(ActivationWarning):
                result = CliRunner().invoke(autofill.main, args)
        else:
            result = CliRunner().invoke(autofill.main, args)
    if not fail:
        assert result.exit_code == 0, result.output
    assert len(modes) == (0 if allowsleep else 1)
    assert all(not mode.active for mode in modes), "Mode must be released even on an exception"
    assert ("System sleep is being prevented" in caplog.text) is (active and not allowsleep)
    assert ("Sleep prevention is unavailable" in caplog.text) is (not active and not allowsleep)


@pytest.mark.parametrize(
    "version,expected",
    [
        ("GPL Ghostscript 10.08.0", True),
        ("10.05.0", True),
        ("11.0.0", True),
        ("10.04.0", False),
        ("10.00.0", False),
        (None, False),
        ("unknown", False),
    ],
)
def test_ghostscript_version_floor(version, expected):
    assert pdf_maker.is_ghostscript_version_supported(version) is expected


def test_supported_windows_install_wins_over_old_path(monkeypatch, tmp_path):
    current = tmp_path / "gs" / "gs10.08.0" / "bin" / "gswin64c.exe"
    current.parent.mkdir(parents=True)
    current.touch()
    monkeypatch.setenv("ProgramFiles", str(tmp_path))
    monkeypatch.setattr(pdf_maker.sys, "platform", "win32")
    monkeypatch.setattr(pdf_maker.shutil, "which", lambda name, **_: "/old/gs" if name == "gs" else None)
    monkeypatch.setattr(
        pdf_maker, "get_ghostscript_version", lambda path: "10.02.1" if path == "/old/gs" else "10.08.0"
    )
    assert pdf_maker.get_ghostscript_path() == str(current)
    assert pdf_maker.get_ghostscript_path("/old/gs") == "/old/gs", "Explicit paths must not silently change"


def test_failed_ghostscript_upgrade_does_not_loop(monkeypatch):
    monkeypatch.setattr(autofill, "get_ghostscript_path", lambda: "/old/gs")
    monkeypatch.setattr(autofill, "get_ghostscript_version", lambda _: "10.00.0")
    monkeypatch.setattr(autofill.click, "confirm", lambda *_, **__: True)
    attempts = []
    monkeypatch.setattr(autofill, "_install_ghostscript", lambda: attempts.append(1) or True)
    with pytest.raises(autofill.click.ClickException, match="Upgrade Ghostscript and check your PATH"):
        autofill.ensure_ghostscript_available()
    assert attempts == [1]


def test_unsupported_direct_conversion_preserves_existing_output(monkeypatch, tmp_path):
    output = tmp_path / "existing.pdf"
    output.write_bytes(b"previous")
    monkeypatch.setattr(pdf_maker, "get_ghostscript_version", lambda _: "10.00.0")
    assert not pdf_maker.convert_pdf_to_pdfx(
        "input.pdf", str(output), pdf_maker.PdfXConversionConfig(ghostscript_path="old-gs")
    )
    assert output.read_bytes() == b"previous"
    assert list(tmp_path.iterdir()) == [output]


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX executable fixture")
def test_supported_ghostscript_later_on_path_is_not_hidden(monkeypatch, tmp_path):
    for directory, version in [("old", "10.00.0"), ("supported", "10.08.0")]:
        path = tmp_path / directory / "gs"
        path.parent.mkdir()
        path.write_text(f'#!/bin/sh\nprintf "%s\\n" "{version}"\n')
        path.chmod(0o755)
    monkeypatch.setenv("PATH", f"{tmp_path / 'old'}:{tmp_path / 'supported'}")
    assert pdf_maker.get_ghostscript_path() == str(tmp_path / "supported" / "gs")
