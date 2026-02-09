import time
from types import SimpleNamespace

import pytest
from selenium.webdriver.common.by import By

from src.constants import States, TargetSites
from src.driver import AutofillDriver


@pytest.fixture
def dtc_driver(monkeypatch: pytest.MonkeyPatch) -> AutofillDriver:
    monkeypatch.setattr(AutofillDriver, "__attrs_post_init__", lambda self: None)
    driver = AutofillDriver(target_site=TargetSites.DriveThruCards)
    driver.set_state = lambda *_args, **_kwargs: None  # avoid status bar dependency in unit tests
    return driver


def test_execute_drive_thru_cards_order_runs_expected_sequence(dtc_driver: AutofillDriver) -> None:
    calls = []
    dtc_driver.driver = SimpleNamespace(get=lambda url: calls.append(("get", url)))

    dtc_driver.wait_for_cloudflare_challenge = lambda: calls.append(("wait_for_cloudflare_challenge",))
    dtc_driver.authenticate_dtc = lambda: calls.append(("authenticate_dtc",)) or True
    dtc_driver.navigate_to_dtc_product_setup = lambda: calls.append(("navigate_to_dtc_product_setup",))
    dtc_driver.fill_dtc_product_form = lambda order: calls.append(("fill_dtc_product_form", order.name))
    dtc_driver.submit_dtc_description_page = lambda: calls.append(("submit_dtc_description_page",))
    dtc_driver.open_dtc_upload_page = lambda: calls.append(("open_dtc_upload_page",))
    dtc_driver.select_card_type_and_upload_pdf = lambda pdf_path: calls.append(("upload_pdf", pdf_path))

    order = SimpleNamespace(name="My Order")
    dtc_driver.execute_drive_thru_cards_order(order=order, pdf_path="/tmp/order.pdf")

    assert calls == [
        ("get", TargetSites.DriveThruCards.value.starting_url),
        ("wait_for_cloudflare_challenge",),
        ("authenticate_dtc",),
        ("navigate_to_dtc_product_setup",),
        ("fill_dtc_product_form", "My Order"),
        ("submit_dtc_description_page",),
        ("open_dtc_upload_page",),
        ("upload_pdf", "/tmp/order.pdf"),
    ]


def test_authenticate_dtc_returns_immediately_when_already_logged_in(dtc_driver: AutofillDriver) -> None:
    dtc_driver.is_dtc_user_authenticated = lambda: True
    dtc_driver._click_dtc_login_button = lambda: (_ for _ in ()).throw(AssertionError("should not click"))
    dtc_driver.click_element_polling = lambda *_args, **_kwargs: (_ for _ in ()).throw(
        AssertionError("should not poll")
    )

    assert dtc_driver.authenticate_dtc() is True


def test_authenticate_dtc_uses_xpath_then_css_fallback(monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver) -> None:
    auth_checks = iter([False, False, True])
    dtc_driver.is_dtc_user_authenticated = lambda: next(auth_checks)
    dtc_driver._click_dtc_login_button = lambda: True

    polling_calls = []

    def fake_click_element_polling(by: By, selector: str, timeout: int = 30) -> bool:
        polling_calls.append((by, selector, timeout))
        if by == By.XPATH:
            return False
        return True

    dtc_driver.click_element_polling = fake_click_element_polling
    monkeypatch.setattr(time, "sleep", lambda _seconds: None)

    assert dtc_driver.authenticate_dtc() is True

    assert polling_calls[0][0] == By.XPATH
    assert "Go to Log in" in polling_calls[0][1]
    assert polling_calls[1][0] == By.CSS_SELECTOR
    assert polling_calls[1][1] == TargetSites.DriveThruCards.value.selectors.go_to_login_selector


def test_authenticate_dtc_returns_false_on_timeout(monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver) -> None:
    dtc_driver.is_dtc_user_authenticated = lambda: False
    dtc_driver._click_dtc_login_button = lambda: False
    dtc_driver.click_element_polling = lambda *_args, **_kwargs: False

    time_values = iter([0.0, 301.0])
    monkeypatch.setattr(time, "time", lambda: next(time_values))
    monkeypatch.setattr(time, "sleep", lambda _seconds: None)

    assert dtc_driver.authenticate_dtc() is False


def test_execute_drive_thru_cards_order_raises_when_login_not_completed(dtc_driver: AutofillDriver) -> None:
    dtc_driver.driver = SimpleNamespace(get=lambda _url: None)
    dtc_driver.wait_for_cloudflare_challenge = lambda: None
    dtc_driver.authenticate_dtc = lambda: False
    dtc_driver.navigate_to_dtc_product_setup = lambda: (_ for _ in ()).throw(AssertionError("should not continue"))

    with pytest.raises(Exception, match="login was not completed"):
        dtc_driver.execute_drive_thru_cards_order(order=SimpleNamespace(name="x"), pdf_path="/tmp/x.pdf")


def test_execute_drive_thru_cards_order_wraps_step_failures_with_context(dtc_driver: AutofillDriver) -> None:
    dtc_driver.driver = SimpleNamespace(get=lambda _url: None)
    dtc_driver.wait_for_cloudflare_challenge = lambda: None
    dtc_driver.authenticate_dtc = lambda: True
    dtc_driver.navigate_to_dtc_product_setup = lambda: (_ for _ in ()).throw(RuntimeError("new UI mismatch"))

    with pytest.raises(Exception, match="step 'navigate_to_dtc_product_setup' failed"):
        dtc_driver.execute_drive_thru_cards_order(order=SimpleNamespace(name="x"), pdf_path="/tmp/x.pdf")


def test_navigate_to_dtc_product_setup_uses_fast_polling_and_no_direct_fallback(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    poll_calls = []
    debug_logs = []
    get_calls = []

    dtc_driver.driver = SimpleNamespace(get=lambda url: get_calls.append(url))

    def fake_poll(by, selector, timeout=30):
        poll_calls.append((by, selector, timeout))
        return True

    dtc_driver.click_element_polling = fake_poll
    monkeypatch.setattr("src.driver.logger.debug", lambda msg: debug_logs.append(msg))

    dtc_driver.navigate_to_dtc_product_setup()

    assert poll_calls == [
        (By.CSS_SELECTOR, TargetSites.DriveThruCards.value.selectors.logged_in_indicator_selector, 1),
        (By.XPATH, "//a[contains(@href, 'pub_enter_product.php')]", 2),
    ]
    assert "Clicked 'Publisher Tools' link." in debug_logs
    assert "Clicked 'Set up a new title' link." in debug_logs
    assert get_calls == []


def test_navigate_to_dtc_product_setup_direct_navigates_on_missing_links(dtc_driver: AutofillDriver) -> None:
    get_calls = []
    dtc_driver.driver = SimpleNamespace(get=lambda url: get_calls.append(url))
    dtc_driver.click_element_polling = lambda *_args, **_kwargs: False

    dtc_driver.navigate_to_dtc_product_setup()

    assert get_calls == [
        "https://site.drivethrucards.com/pub_tools.php",
        "https://tools.drivethrucards.com/pub_enter_product.php",
    ]


def test_wait_for_cloudflare_challenge_returns_when_site_loaded(dtc_driver: AutofillDriver) -> None:
    dtc_driver._is_site_loaded = lambda: True
    dtc_driver._is_cloudflare_challenge_active = lambda: (_ for _ in ()).throw(
        AssertionError("should not check challenge when site already loaded")
    )

    dtc_driver.wait_for_cloudflare_challenge(timeout_seconds=1)


def test_open_dtc_upload_page_extracts_window_open_url(monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver) -> None:
    script_calls = []

    class UploadButton:
        def get_attribute(self, name: str) -> str:
            assert name == "onclick"
            return "window.open('https://tools.drivethrucards.com/pub_upload_podcard_files.php?products_id=123');"

    class FakeWait:
        call_count = 0

        def __init__(self, *_args, **_kwargs):
            pass

        def until(self, _condition):
            FakeWait.call_count += 1
            if FakeWait.call_count == 1:
                return UploadButton()
            return object()

    dtc_driver.driver = SimpleNamespace(
        execute_script=lambda script, url: script_calls.append((script, url)),
        current_url="https://tools.drivethrucards.com/pub_upload_podcard_files.php?products_id=123",
    )

    monkeypatch.setattr("src.driver.WebDriverWait", FakeWait)

    dtc_driver.open_dtc_upload_page()

    assert script_calls == [
        ("window.location.href = arguments[0];", "https://tools.drivethrucards.com/pub_upload_podcard_files.php?products_id=123")
    ]


def test_is_site_loaded_uses_login_or_logged_in_selectors(dtc_driver: AutofillDriver) -> None:
    selectors = TargetSites.DriveThruCards.value.selectors

    class FakeWebDriver:
        def __init__(self) -> None:
            self.title = "DriveThruCards"
            self.wait_values = []

        def implicitly_wait(self, value: int) -> None:
            self.wait_values.append(value)

        def find_elements(self, by: By, selector: str):
            if by == By.CSS_SELECTOR and selector == selectors.login_button_selector:
                return [object()]
            if by == By.CSS_SELECTOR and selector == selectors.logged_in_indicator_selector:
                return []
            return []

    fake_driver = FakeWebDriver()
    dtc_driver.driver = fake_driver

    assert dtc_driver._is_site_loaded() is True
    assert fake_driver.wait_values == [0, 5]
