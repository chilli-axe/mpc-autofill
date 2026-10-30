"""Local DOM checks for upload events and page transitions, without a DriveThruCards account.

The upload input models the site's Dropzone instance; later pages are simplified fixtures.
CHROME_BINARY and CHROMEDRIVER can select an existing local browser/driver pair.
"""

import os
import platform
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from selenium.webdriver import Chrome, ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait

from src.constants import TargetSites
from src.driver import AutofillDriver
from src.webdrivers import get_undetected_chrome_driver


@pytest.fixture(scope="module")
def browser():
    options = ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    if os.environ.get("CHROME_BINARY"):
        options.binary_location = os.environ["CHROME_BINARY"]
    service = Service(executable_path=os.environ.get("CHROMEDRIVER"))
    driver = Chrome(options=options, service=service)
    try:
        yield driver
    finally:
        driver.quit()


@pytest.fixture
def upload_page(tmp_path):
    # The input is hidden as in Dropzone. Native send_keys must fire exactly one
    # change event, and an invalid file must leave the upload button disabled.
    (tmp_path / "upload.html").write_text(
        """<!doctype html><title>Upload fixture</title>
        <select id="card_type_select"><option>Choose</option><option>Premium Euro Poker Card(s)</option></select>
        <div id="uploadfiles"></div>
        <input type="file" onchange="sessionStorage.setItem('unrelatedChanges', '1')">
        <input type="file" data-card-file style="visibility:hidden;position:absolute;width:0;height:0">
        <button id="dropzoneButton" disabled>Begin Card File Upload</button>
        <div id="status_messages"></div>
        <button id="continue_button" onclick="return false">Continue</button>
        <script>
        sessionStorage.setItem('changes', '0');
        sessionStorage.setItem('unrelatedChanges', '0');
        sessionStorage.setItem('uploads', '0');
        const mode = new URLSearchParams(location.search).get('mode');
        const button = document.getElementById('dropzoneButton');
        const status = document.getElementById('status_messages');
        if (mode === 'delayed_status') status.remove();
        const fileInput = document.querySelector('[data-card-file]');
        document.getElementById('uploadfiles').dropzone = {hiddenFileInput: fileInput};
        fileInput.addEventListener('change', event => {
            sessionStorage.setItem('changes', Number(sessionStorage.getItem('changes')) + 1);
            button.disabled = mode === 'rejected' || !event.target.files.length;
            if (button.disabled) status.textContent = 'Invalid PDF';
        });
        button.onclick = () => {
            sessionStorage.setItem('uploads', Number(sessionStorage.getItem('uploads')) + 1);
            if (mode === 'server_rejected') {
                status.textContent = 'Card file order.pdf upload failed. ' +
                    'Previous successfully uploaded card file (if present) was not replaced.';
                return;
            }
            status.textContent = 'Card file ' + fileInput.files[0].name + ' successfully uploaded!';
            if (mode === 'delayed_status') setTimeout(() => document.body.append(status), 700);
            if (mode === 'continue_inactive') return;
            document.getElementById('continue_button').setAttribute('onclick',
                "location.href='setup.html?mode=" + mode + "'");
        };
        </script>""",
        encoding="utf-8",
    )
    (tmp_path / "setup.html").write_text(
        """<!doctype html><title>Complete setup fixture</title>
        <button id="submit_id">Complete Setup</button>
        <script>
        document.getElementById('submit_id').onclick = () => {
            const mode = new URLSearchParams(location.search).get('mode');
            const target = mode === 'redirected' ? 'login' : 'cart';
            document.body.innerHTML = '<a href="' + target + '.html?action=buy_now&products_id=123&mode=' + mode + '">Buy now</a>';
        };
        </script>""",
        encoding="utf-8",
    )
    (tmp_path / "cart.html").write_text(
        """<!doctype html><title>Cart fixture</title><p>Order 123</p>
        <script>
        if (new URLSearchParams(location.search).get('mode') === 'authenticated_with_login') {
            document.body.insertAdjacentHTML('beforeend',
                '<button data-cy="login">Log in</button><button data-cy="accountMenu">Account</button>');
        }
        </script>""",
        encoding="utf-8",
    )
    (tmp_path / "login.html").write_text(
        '<!doctype html><title>Login fixture</title><button data-cy="login">Log in</button>', encoding="utf-8"
    )
    pdf = tmp_path / "order.pdf"
    pdf.write_bytes(b"%PDF-1.4\n%%EOF\n")

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(tmp_path)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/upload.html", pdf
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.mark.parametrize(
    "mode",
    [
        "accepted",
        "rejected",
        "server_rejected",
        "redirected",
        "authenticated_with_login",
        "delayed_status",
        "continue_inactive",
    ],
)
def test_pdf_upload_respects_native_file_events_and_validation(browser, upload_page, monkeypatch, mode):
    monkeypatch.setattr(AutofillDriver, "__attrs_post_init__", lambda self: None)
    driver = AutofillDriver(target_site=TargetSites.DriveThruCards, driver=browser)
    driver.set_state = lambda *_args, **_kwargs: None
    # Keep the real Selenium waits and predicates, with a short timeout for rejection.
    monkeypatch.setattr(
        "src.driver.WebDriverWait", lambda browser, _timeout, **kwargs: WebDriverWait(browser, 2, **kwargs)
    )
    url, pdf = upload_page
    browser.get(f"{url}?mode={mode}")
    if mode == "rejected":
        with pytest.raises(Exception, match="did not accept the PDF for upload"):
            driver.select_card_type_and_upload_pdf(str(pdf))
        assert browser.find_element("id", "dropzoneButton").get_property("disabled") is True
    elif mode == "server_rejected":
        with pytest.raises(Exception, match="upload was not confirmed"):
            driver.select_card_type_and_upload_pdf(str(pdf))
        assert browser.find_element("id", "continue_button").get_attribute("onclick") == "return false"
    elif mode == "continue_inactive":
        driver.select_card_type_and_upload_pdf(str(pdf))
        with pytest.raises(Exception, match="continue button did not activate"):
            driver.complete_dtc_product_setup()
    elif mode == "redirected":
        driver.select_card_type_and_upload_pdf(str(pdf))
        with pytest.raises(Exception, match="requires sign-in before the cart handoff"):
            driver.complete_dtc_product_setup()
        assert browser.title == "Login fixture"
    else:
        driver.select_card_type_and_upload_pdf(str(pdf))
        driver.complete_dtc_product_setup()
        assert browser.title == "Cart fixture"
    assert browser.execute_script("return sessionStorage.getItem('changes')") == "1"
    assert browser.execute_script("return sessionStorage.getItem('unrelatedChanges')") == "0"
    assert browser.execute_script("return sessionStorage.getItem('uploads')") == ("0" if mode == "rejected" else "1")


def test_click_polling_ignores_hidden_and_disabled_matches(browser, monkeypatch):
    monkeypatch.setattr(AutofillDriver, "__attrs_post_init__", lambda self: None)
    driver = AutofillDriver(target_site=TargetSites.DriveThruCards, driver=browser)
    browser.get(
        "data:text/html,<button hidden>Hidden</button><button disabled>Disabled</button>"
        "<button onclick=\"document.title='Clicked'\">Ready</button>"
    )
    assert driver.click_element_polling("css selector", "button", timeout=2) is True
    assert browser.title == "Clicked"


@pytest.mark.skipif(sys.platform != "linux", reason="Linux DTC browser stack smoke")
def test_actual_dtc_browser_factory_with_temporary_profile(upload_page, tmp_path):
    url, _pdf = upload_page
    driver = get_undetected_chrome_driver(
        headless=True,
        binary_location=os.environ.get("CHROME_BINARY"),
        user_data_dir=str(tmp_path / "browser-profile"),
    )
    try:
        driver.get(url)
        assert driver.title == "Upload fixture"
        driver.find_element("id", "card_type_select").click()
        assert driver.execute_script("return document.readyState") == "complete"
    finally:
        driver.quit()


@pytest.mark.skipif(
    sys.platform != "darwin" or platform.machine() != "arm64", reason="Apple Silicon DTC browser stack smoke"
)
def test_native_mac_dtc_browser_preserves_stealth_and_profile(tmp_path, monkeypatch):
    # Selenium prefers SE_CHROMEDRIVER over the driver path it is given, which would bypass the patched driver.
    monkeypatch.delenv("SE_CHROMEDRIVER", raising=False)
    driver = get_undetected_chrome_driver(
        headless=True,
        binary_location=os.environ.get("CHROME_BINARY"),
        user_data_dir=str(tmp_path),
        profile_directory="Profile 7",
    )
    try:
        driver.get("data:text/html,<title>DTC driver smoke</title><body>Local fixture</body>")
        driver.find_element("tag name", "body")
        assert driver.execute_script("return Object.keys(window).filter(k => k.startsWith('cdc_'))") == []
        assert not driver.execute_script("return navigator.webdriver")
        driver.get("chrome://version")
        profile_path = driver.find_element("id", "profile_path").text
        assert Path(profile_path).resolve() == (tmp_path / "Profile 7").resolve()
    finally:
        driver.quit()


@pytest.mark.parametrize(
    ("html", "authenticated", "publisher_ready"),
    [
        ("<button data-cy='accountMenu' hidden>Account</button><a href='pub_tools.php' hidden>Tools</a>", False, False),
        ("<button data-cy='accountMenu'>Account</button>", True, False),
        ("<button>Log Off</button>", True, False),
        ("<a href='pub_tools.php'>Tools</a>", True, True),
        ("<button>Publisher Tools</button>", False, True),
    ],
)
def test_account_and_publisher_visibility(browser, monkeypatch, html, authenticated, publisher_ready):
    monkeypatch.setattr(AutofillDriver, "__attrs_post_init__", lambda self: None)
    driver = AutofillDriver(target_site=TargetSites.DriveThruCards, driver=browser)
    browser.get("data:text/html," + html)
    assert driver.is_dtc_user_authenticated() is authenticated
    assert driver.is_dtc_publisher_ready() is publisher_ready
