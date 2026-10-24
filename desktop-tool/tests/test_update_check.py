import json
import runpy
import sys
from http.client import IncompleteRead
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from urllib.request import HTTPSHandler, urlopen
from urllib.response import addinfourl

import click
import pytest
from click.testing import CliRunner

from src import build_info, update_check

import autofill as autofill_cli
from write_build_info import write_build_info


@pytest.fixture(autouse=True)
def configured_build(monkeypatch, tmp_path):
    monkeypatch.setattr(build_info, "VERSION", "1.2.4")
    monkeypatch.setattr(build_info, "RELEASE_REPOSITORY", "bwsinger/mpc-autofill")
    monkeypatch.setattr(click, "get_app_dir", lambda _name: str(tmp_path / "settings"))
    set_interactive(monkeypatch, True)
    monkeypatch.setattr(update_check, "urlopen", lambda *_args, **_kwargs: pytest.fail("Unexpected network lookup"))
    monkeypatch.setattr(update_check.webbrowser, "open", lambda _url: pytest.fail("Unexpected browser launch"))
    monkeypatch.setattr(click, "confirm", lambda *_args, **_kwargs: pytest.fail("Unexpected prompt"))


def set_interactive(monkeypatch, interactive):
    stream = SimpleNamespace(isatty=lambda: interactive)
    monkeypatch.setattr(update_check, "sys", SimpleNamespace(stdin=stream, stdout=stream))


def preference_path():
    return update_check.get_preference_path(build_info.RELEASE_REPOSITORY)


def mock_release(monkeypatch, release=None):
    if release is None:
        release = {"tag_name": "dtc-v1.2.5", "draft": False, "prerelease": False}
    calls = []

    def fetch(request, timeout):
        calls.append((request, timeout))
        return BytesIO(json.dumps(release).encode())

    monkeypatch.setattr(update_check, "urlopen", fetch)
    return calls


@pytest.mark.parametrize(
    ("tag", "expected"),
    [
        ("dtc-v1.2.4", (1, 2, 4, 0)),
        ("v4.7", (4, 7, 0, 0)),
        ("1.2.4.1", (1, 2, 4, 1)),
        ("1.10.0", (1, 10, 0, 0)),
        ("v1.2.4-rc1", None),
        ("1.2.4+build", None),
        ("release-1.2.5", None),
        ("1", None),
        ("v1.2.3/../../elsewhere", None),
        ("1.2\n", None),
    ],
)
def test_parse_stable_release_versions(tag, expected):
    assert update_check.parse_release_version(tag) == expected


@pytest.mark.parametrize("enabled", [True, False])
def test_preference_survives_version_changes_and_executable_moves(monkeypatch, tmp_path, enabled):
    original_path = preference_path()
    update_check.save_preference(original_path, enabled)
    monkeypatch.setattr(build_info, "VERSION", "1.2.5")
    monkeypatch.chdir(tmp_path)
    assert preference_path() == original_path
    assert update_check.read_preference(preference_path()) is enabled
    assert update_check.get_preference_path("BWSINGER/mpc-autofill") == original_path
    assert update_check.read_preference(update_check.get_preference_path("chilli-axe/mpc-autofill")) is None


@pytest.mark.parametrize(
    "contents",
    ['{"enabled": "false"}', '{"enabled": 1}', '{"enabled": null}', "[]", "null", "true", "{}", "broken", "\udcff"],
)
def test_malformed_preferences_never_count_as_consent(contents):
    path = preference_path()
    path.parent.mkdir(parents=True)
    path.write_bytes(contents.encode("utf-8", errors="surrogateescape"))
    assert update_check.read_preference(path) is None


def test_unreadable_preferences_are_undecided(monkeypatch):
    monkeypatch.setattr(Path, "read_text", lambda *_args, **_kwargs: (_ for _ in ()).throw(PermissionError()))
    assert update_check.read_preference(preference_path()) is None


@pytest.mark.parametrize("operation", ["mkdir", "replace"])
def test_failed_preference_save_does_not_stop_run_or_destroy_saved_no(monkeypatch, capsys, operation):
    path = preference_path()
    update_check.save_preference(path, False)

    def fail(*_args, **_kwargs):
        raise PermissionError()

    if operation == "mkdir":
        monkeypatch.setattr(Path, "mkdir", fail)
    else:
        monkeypatch.setattr(update_check.os, "replace", fail)
    update_check.save_preference(path, True)
    assert update_check.read_preference(path) is False
    assert "Could not save" in capsys.readouterr().err
    assert list(path.parent.iterdir()) == [path]


@pytest.mark.parametrize("consent", [True, False])
def test_first_run_asks_and_remembers_consent(monkeypatch, consent):
    prompts = []

    def confirm(message, default):
        assert default is False
        assert not preference_path().exists()
        prompts.append(message)
        return consent

    monkeypatch.setattr(click, "confirm", confirm)
    calls = mock_release(monkeypatch, {"tag_name": "dtc-v1.2.4", "draft": False, "prerelease": False})
    assert update_check.check_for_updates() is False
    assert len(prompts) == 1
    assert "bwsinger/mpc-autofill" in prompts[0]
    assert update_check.read_preference(preference_path()) is consent
    assert len(calls) == int(consent)
    monkeypatch.setattr(click, "confirm", lambda *_args, **_kwargs: pytest.fail("Asked for consent twice"))
    assert update_check.check_for_updates() is False
    assert len(calls) == 2 * int(consent)


@pytest.mark.parametrize("remembered", [None, True, False])
def test_headless_startup_never_checks_prompts_or_writes(monkeypatch, remembered):
    if remembered is not None:
        update_check.save_preference(preference_path(), remembered)
    set_interactive(monkeypatch, False)
    assert update_check.check_for_updates() is False
    assert update_check.read_preference(preference_path()) is remembered


@pytest.mark.parametrize("interactive", [True, False])
@pytest.mark.parametrize("enabled", [True, False])
def test_explicit_flags_override_and_persist_consent(monkeypatch, interactive, enabled):
    update_check.save_preference(preference_path(), not enabled)
    set_interactive(monkeypatch, interactive)
    calls = mock_release(monkeypatch, {"tag_name": "v1.2.4", "draft": False, "prerelease": False})
    assert update_check.check_for_updates(enabled) is False
    assert update_check.read_preference(preference_path()) is enabled
    assert len(calls) == int(enabled)


@pytest.mark.parametrize("field", ["VERSION", "RELEASE_REPOSITORY"])
def test_unconfigured_source_never_checks_or_saves(monkeypatch, field):
    monkeypatch.setattr(build_info, field, None)
    assert update_check.check_for_updates(True) is False
    assert not (Path(click.get_app_dir("mpc-autofill")) / "update-checks").exists()


@pytest.mark.parametrize(
    "release",
    [
        {},
        [],
        None,
        {"tag_name": 7, "draft": False, "prerelease": False},
        {"tag_name": "v2.0", "draft": True, "prerelease": False},
        {"tag_name": "v2.0", "draft": False, "prerelease": True},
        {"tag_name": "v2.0", "draft": 0, "prerelease": False},
        {"tag_name": "v2.0"},
        {"tag_name": "dtc-v2.0-beta", "draft": False, "prerelease": False},
        {"tag_name": "v1.2.3", "draft": False, "prerelease": False},
        {"tag_name": "1.2.4.0", "draft": False, "prerelease": False},
    ],
)
def test_no_notice_for_old_equal_unstable_or_malformed_releases(monkeypatch, capsys, release):
    # None is deliberately malformed JSON data, rather than mock_release's default.
    monkeypatch.setattr(update_check, "urlopen", lambda *_args, **_kwargs: BytesIO(json.dumps(release).encode()))
    assert update_check.check_for_updates(True) is False
    assert not capsys.readouterr().out


@pytest.mark.parametrize(
    "failure",
    [
        URLError("offline"),
        TimeoutError(),
        OSError("TLS"),
        IncompleteRead(b"partial", 20),
        RecursionError(),
        HTTPError("https://api.github.com", 403, "rate limited", {}, None),
        HTTPError("https://api.github.com", 404, "no releases", {}, None),
        ValueError("invalid JSON"),
    ],
)
def test_lookup_failures_are_nonfatal(monkeypatch, capsys, failure):
    def fetch(*_args, **_kwargs):
        raise failure

    monkeypatch.setattr(update_check, "urlopen", fetch)
    assert update_check.check_for_updates(True) is False
    assert "continuing" in capsys.readouterr().err


def test_bad_json_is_nonfatal(monkeypatch):
    monkeypatch.setattr(update_check, "urlopen", lambda *_args, **_kwargs: BytesIO(b"not json"))
    assert update_check.check_for_updates(True) is False


def test_transport_does_not_attach_netrc_credentials(monkeypatch, tmp_path):
    netrc = tmp_path / "netrc"
    netrc.write_text("machine api.github.com login test-user password test-password\n")
    monkeypatch.setenv("NETRC", str(netrc))
    monkeypatch.setattr(update_check, "urlopen", urlopen)
    requests = []

    def https_open(_handler, request):
        requests.append(request)
        response = addinfourl(
            BytesIO(b'{"tag_name":"v1.2.4","draft":false,"prerelease":false}'), {}, request.full_url, code=200
        )
        response.msg = "OK"
        return response

    monkeypatch.setattr(HTTPSHandler, "https_open", https_open)
    assert update_check.check_for_updates(True) is False
    assert len(requests) == 1
    assert requests[0].get_header("Authorization") is None


@pytest.mark.parametrize("open_page", [True, False])
@pytest.mark.parametrize("browser_result", [True, False, OSError("no browser")])
def test_update_offer_uses_trusted_url_and_only_stops_after_opening(monkeypatch, capsys, open_page, browser_result):
    release = {"tag_name": "dtc-v1.10.0", "draft": False, "prerelease": False, "html_url": "https://evil.test"}
    calls = mock_release(monkeypatch, release)
    monkeypatch.setattr(click, "confirm", lambda _message, default: open_page)
    opened = []

    def browser(url):
        opened.append(url)
        if isinstance(browser_result, Exception):
            raise browser_result
        return browser_result

    monkeypatch.setattr(update_check.webbrowser, "open", browser)
    assert update_check.check_for_updates(True) is (open_page and browser_result is True)
    url = "https://github.com/bwsinger/mpc-autofill/releases/tag/dtc-v1.10.0"
    assert opened == ([url] if open_page else [])
    request, timeout = calls[0]
    assert request.full_url == "https://api.github.com/repos/bwsinger/mpc-autofill/releases/latest"
    assert timeout == 3
    assert "Authorization" not in request.headers
    assert request.get_header("User-agent") == "mpc-autofill"
    output = capsys.readouterr().out
    assert url in output and "evil.test" not in output


def test_headless_explicit_check_prints_link_without_opening_or_prompting(monkeypatch, capsys):
    set_interactive(monkeypatch, False)
    mock_release(monkeypatch)
    assert update_check.check_for_updates(True) is False
    assert "Download: https://github.com/bwsinger/mpc-autofill/releases/tag/dtc-v1.2.5" in capsys.readouterr().out


def test_update_accepted_exits_before_onboarding_or_order_work(monkeypatch, tmp_path):
    mock_release(monkeypatch)
    monkeypatch.setattr(click, "confirm", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(update_check.webbrowser, "open", lambda _url: True)
    monkeypatch.setattr(autofill_cli, "should_run_interactive_onboarding", lambda: pytest.fail("Reached onboarding"))
    missing_order_directory = tmp_path / "missing"
    result = CliRunner().invoke(autofill_cli.main, ["--check-updates", "--directory", str(missing_order_directory)])
    assert result.exit_code == 0, result.output
    assert not missing_order_directory.exists()
    assert update_check.read_preference(preference_path()) is True


@pytest.mark.parametrize("open_page", [True, False])
def test_declined_update_or_browser_failure_continues_setup(monkeypatch, open_page):
    mock_release(monkeypatch)
    monkeypatch.setattr(click, "confirm", lambda *_args, **_kwargs: open_page)
    monkeypatch.setattr(update_check.webbrowser, "open", lambda _url: False)
    monkeypatch.setattr(autofill_cli, "should_run_interactive_onboarding", lambda: True)

    def onboarding():
        raise RuntimeError("Reached normal setup")

    monkeypatch.setattr(autofill_cli, "run_interactive_onboarding", onboarding)
    result = CliRunner().invoke(autofill_cli.main, ["--check-updates"])
    assert isinstance(result.exception, RuntimeError)
    assert str(result.exception) == "Reached normal setup"


@pytest.mark.parametrize("args", [["--help"], ["--version"], ["--check-tls"]])
def test_diagnostic_commands_bypass_update_checks(monkeypatch, args):
    monkeypatch.setattr(autofill_cli, "check_for_updates", lambda *_args: pytest.fail("Ran update check"))
    monkeypatch.setattr(autofill_cli, "check_tls_connection", lambda: None)
    result = CliRunner().invoke(autofill_cli.main, args)
    assert result.exit_code == 0, result.output
    assert not preference_path().exists()


@pytest.mark.parametrize("flag", ["--check-updates", "--no-check-updates"])
def test_update_preference_flags_preserve_no_argument_onboarding(monkeypatch, flag):
    monkeypatch.setattr(sys, "argv", ["autofill", flag])
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr(sys.stdout, "isatty", lambda: True)
    assert autofill_cli.should_run_interactive_onboarding()


def test_build_metadata_is_generated_at_destination_only(tmp_path):
    destination = tmp_path / "build_info.py"
    write_build_info("4.7.0", "chilli-axe/mpc-autofill", destination)
    metadata = runpy.run_path(str(destination))
    assert metadata["VERSION"] == "4.7.0"
    assert metadata["RELEASE_REPOSITORY"] == "chilli-axe/mpc-autofill"


@pytest.mark.parametrize(
    ("version", "repository"),
    [
        ("dtc-v1.2.5", "bwsinger/mpc-autofill"),
        ("1.2-rc", "bwsinger/mpc-autofill"),
        ("1.2.3", "../escape"),
        ("1.2.3", "owner/repo/extra"),
        ("1.2.3", "https://github.com/owner/repo"),
    ],
)
def test_invalid_build_identity_is_rejected_without_overwriting(tmp_path, version, repository):
    destination = tmp_path / "build_info.py"
    destination.write_text("original")
    with pytest.raises(ValueError):
        write_build_info(version, repository, destination)
    assert destination.read_text() == "original"
