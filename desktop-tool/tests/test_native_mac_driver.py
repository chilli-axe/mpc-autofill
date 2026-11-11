import subprocess
from pathlib import Path
from unittest.mock import Mock, call

import pytest
import undetected_chromedriver as uc
from selenium.webdriver.common import selenium_manager

from src import webdrivers


@pytest.fixture
def native_driver(monkeypatch, tmp_path):
    source = tmp_path / "selenium-chromedriver"
    source.write_bytes(b"original driver")
    cache = tmp_path / "uc-cache"
    patcher = Mock()
    patcher.is_binary_patched.return_value = True
    patcher_class = Mock(return_value=patcher, data_path=str(cache))
    manager = Mock()
    manager.return_value.binary_paths.return_value = {"driver_path": str(source)}
    chrome = Mock(return_value=object())
    detect = Mock(return_value=156)
    monkeypatch.setattr(uc, "Patcher", patcher_class)
    monkeypatch.setattr(uc, "Chrome", chrome)
    monkeypatch.setattr(selenium_manager, "SeleniumManager", manager)
    monkeypatch.setattr(webdrivers, "_detect_chrome_version", detect)
    monkeypatch.setattr(webdrivers.sys, "platform", "darwin")
    monkeypatch.setattr(webdrivers.platform, "machine", lambda: "arm64")
    return cache / "chromedriver-mac-arm64-156", patcher, manager, chrome, detect


@pytest.mark.parametrize(
    "system,machine", [("darwin", "arm64"), ("darwin", "x86_64"), ("linux", "arm64"), ("win32", "arm64")]
)
def test_native_driver_is_only_used_on_apple_silicon(monkeypatch, native_driver, system, machine):
    target, _patcher, _manager, chrome, detect = native_driver
    prepare = Mock(return_value=str(target))
    monkeypatch.setattr(webdrivers, "_prepare_native_mac_driver", prepare)
    monkeypatch.setattr(webdrivers.sys, "platform", system)
    monkeypatch.setattr(webdrivers.platform, "machine", lambda: machine)

    result = webdrivers.get_undetected_chrome_driver(
        headless=True, binary_location="/selected/chrome", user_data_dir="/my/profile", profile_directory="Profile 7"
    )

    assert result is chrome.return_value
    detect.assert_called_once_with("/selected/chrome")
    chrome.assert_called_once()
    kwargs = chrome.call_args.kwargs
    assert kwargs["version_main"] == 156
    assert kwargs["user_data_dir"] == "/my/profile"
    assert kwargs["options"].binary_location == "/selected/chrome"
    assert "--headless=new" in kwargs["options"].arguments
    assert "--profile-directory=Profile 7" in kwargs["options"].arguments
    assert not any(arg.startswith("--user-data-dir") for arg in kwargs["options"].arguments)
    if system == "darwin" and machine == "arm64":
        prepare.assert_called_once_with(156)
        assert kwargs["driver_executable_path"] == str(target)
    else:
        prepare.assert_not_called()
        assert kwargs["driver_executable_path"] is None


def test_existing_patched_native_driver_is_reused(monkeypatch, native_driver):
    target, patcher, manager, chrome, _detect = native_driver
    target.parent.mkdir()
    target.write_bytes(b"patched driver")
    copy = Mock()
    sign = Mock()
    replace = Mock()
    monkeypatch.setattr(webdrivers.shutil, "copy2", copy)
    monkeypatch.setattr(webdrivers.subprocess, "run", sign)
    monkeypatch.setattr(webdrivers.os, "replace", replace)

    webdrivers.get_undetected_chrome_driver(binary_location="/selected/chrome")

    assert chrome.call_args.kwargs["driver_executable_path"] == str(target)
    manager.assert_not_called()
    patcher.patch_exe.assert_not_called()
    copy.assert_not_called()
    sign.assert_not_called()
    replace.assert_not_called()


@pytest.mark.parametrize("existing_unpatched", [False, True])
def test_fresh_native_driver_is_patched_signed_then_replaced(monkeypatch, native_driver, existing_unpatched):
    target, patcher, manager, chrome, _detect = native_driver
    target.parent.mkdir()
    stale = target.parent / "chromedriver-mac-arm64-155"
    stale.write_bytes(b"older major")
    if existing_unpatched:
        target.write_bytes(b"unpatched cached driver")
        original_inode = target.stat().st_ino
        patcher.is_binary_patched.side_effect = [False, True]
    events = Mock()
    events.attach_mock(patcher.patch_exe, "patch")
    sign = Mock()
    replace = Mock(wraps=webdrivers.os.replace)
    events.attach_mock(sign, "sign")
    events.attach_mock(replace, "replace")
    monkeypatch.setattr(webdrivers.subprocess, "run", sign)
    monkeypatch.setattr(webdrivers.os, "replace", replace)

    webdrivers.get_undetected_chrome_driver(binary_location="/selected/chrome")

    manager.return_value.binary_paths.assert_called_once_with(["--browser", "chrome", "--driver-version", "156"])
    tmp = sign.call_args.args[0][-1]
    assert Path(tmp).parent == target.parent
    assert events.mock_calls == [
        call.patch(),
        call.sign(["/usr/bin/codesign", "--force", "--sign", "-", tmp], check=True, capture_output=True),
        call.replace(tmp, target),
    ]
    assert target.read_bytes() == b"original driver"
    if existing_unpatched:
        assert target.stat().st_ino != original_inode
    assert list(target.parent.iterdir()) == [target]
    assert chrome.call_args.kwargs["driver_executable_path"] == str(target)


@pytest.mark.parametrize("failure", ["version", "manager", "copy", "patch", "unpatched", "codesign", "replace"])
def test_native_preparation_failure_warns_and_falls_back(monkeypatch, native_driver, caplog, failure):
    target, patcher, manager, chrome, detect = native_driver
    sign = Mock()
    monkeypatch.setattr(webdrivers.subprocess, "run", sign)
    if failure == "version":
        detect.return_value = None
    elif failure == "manager":
        manager.return_value.binary_paths.side_effect = RuntimeError("manager failed")
    elif failure == "copy":
        monkeypatch.setattr(webdrivers.shutil, "copy2", Mock(side_effect=OSError("copy failed")))
    elif failure == "patch":
        patcher.patch_exe.side_effect = RuntimeError("patch failed")
    elif failure == "unpatched":
        patcher.is_binary_patched.return_value = False
    elif failure == "codesign":
        sign.side_effect = subprocess.CalledProcessError(1, "codesign")
    else:
        monkeypatch.setattr(webdrivers.os, "replace", Mock(side_effect=OSError("replace failed")))

    assert webdrivers.get_undetected_chrome_driver(binary_location="/selected/chrome") is chrome.return_value

    chrome.assert_called_once()
    assert chrome.call_args.kwargs["driver_executable_path"] is None
    assert chrome.call_args.kwargs["version_main"] == detect.return_value
    assert len(caplog.records) == 1
    assert caplog.records[0].levelname == "WARNING"
    assert "native ChromeDriver" in caplog.text
    assert "default driver" in caplog.text
    assert "Rosetta" in caplog.text
    assert not target.exists()
    assert not target.parent.exists() or list(target.parent.iterdir()) == []
    if failure in ("patch", "unpatched"):
        sign.assert_not_called()


def test_native_launch_failure_is_not_retried_with_another_driver(monkeypatch, native_driver):
    target, _patcher, _manager, chrome, _detect = native_driver
    monkeypatch.setattr(webdrivers, "_prepare_native_mac_driver", lambda _major: str(target))
    chrome.side_effect = RuntimeError("native launch failed")

    with pytest.raises(RuntimeError, match="native launch failed"):
        webdrivers.get_undetected_chrome_driver(binary_location="/selected/chrome")
    chrome.assert_called_once()
