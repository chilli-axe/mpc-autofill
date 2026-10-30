"""Failure-boundary regressions; real successful installations use the hosted acceptance script."""

from types import SimpleNamespace

import pytest

from src import pdf_maker

import autofill


@pytest.mark.parametrize("platform", ["win32", "darwin"])
@pytest.mark.parametrize("outcome", [1, 1223, OSError("elevation denied")])
def test_cancelled_or_denied_installer_stops_once_with_recovery(monkeypatch, platform, outcome, fake_gs):
    # Load platform-sensitive dependencies before changing the shared sys module.
    monkeypatch.setattr(pdf_maker.sys, "platform", platform)
    fake_gs(["/old/gs", "/old/gs"], version="10.04.0")
    monkeypatch.setattr(autofill, "_download_ghostscript_installer", lambda *_: "/verified/installer")
    calls = []

    def denied(command, **kwargs):
        calls.append(command)
        if isinstance(outcome, OSError):
            raise outcome
        return SimpleNamespace(returncode=outcome)

    monkeypatch.setattr(autofill.subprocess, "run", denied)
    with pytest.raises(autofill.click.ClickException, match="Upgrade Ghostscript and check your PATH"):
        autofill.ensure_ghostscript_available()
    assert len(calls) == 1
