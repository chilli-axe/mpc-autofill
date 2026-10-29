import pytest

import autofill


@pytest.fixture
def fake_gs(monkeypatch):
    def configure(paths, version="10.08.0", confirm=True):
        monkeypatch.setattr(autofill, "get_ghostscript_path", lambda: paths.pop(0))
        monkeypatch.setattr(autofill, "get_ghostscript_version", version if callable(version) else lambda _: version)
        monkeypatch.setattr(autofill.click, "confirm", confirm if callable(confirm) else lambda *_, **__: confirm)

    return configure
