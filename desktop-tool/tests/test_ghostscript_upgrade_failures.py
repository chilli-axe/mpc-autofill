"""Failure-boundary regressions; real successful installations use the hosted acceptance script."""

from types import SimpleNamespace

import pytest

import autofill


@pytest.mark.parametrize("platform", ["win32", "darwin"])
@pytest.mark.parametrize("outcome", [1, 1223, OSError("elevation denied")])
def test_cancelled_or_denied_installer_stops_once_with_recovery(monkeypatch, platform, outcome):
    monkeypatch.setattr(autofill.sys, "platform", platform)
    monkeypatch.setattr(autofill, "get_ghostscript_path", lambda: "/old/gs")
    monkeypatch.setattr(autofill, "get_ghostscript_version", lambda _: "10.04.0")
    monkeypatch.setattr(autofill, "_download_ghostscript_installer", lambda *_: "/verified/installer")
    monkeypatch.setattr(autofill.click, "confirm", lambda *_, **__: True)
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
