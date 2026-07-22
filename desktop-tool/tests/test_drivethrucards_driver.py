import time
from types import SimpleNamespace

import pytest
from selenium.common import exceptions as sl_exc
from selenium.webdriver.common.by import By

from src.constants import TargetSites
from src.driver import AutofillDriver


@pytest.fixture
def dtc_driver(monkeypatch: pytest.MonkeyPatch) -> AutofillDriver:
    monkeypatch.setattr(AutofillDriver, "__attrs_post_init__", lambda self: None)
    driver = AutofillDriver(target_site=TargetSites.DriveThruCards)
    driver.set_state = lambda *_args, **_kwargs: None  # avoid status bar dependency in unit tests
    return driver


def test_execute_drive_thru_cards_order_runs_expected_sequence(dtc_driver: AutofillDriver) -> None:
    calls = []
    dtc_driver.driver = SimpleNamespace()

    dtc_driver.open_dtc_starting_page = lambda: calls.append(("open_dtc_starting_page",))
    dtc_driver.wait_for_cloudflare_challenge = lambda: calls.append(("wait_for_cloudflare_challenge",))
    dtc_driver.authenticate_dtc = lambda: calls.append(("authenticate_dtc",)) or True
    dtc_driver.ensure_dtc_publisher_account = lambda: calls.append(("ensure_dtc_publisher_account",))
    dtc_driver.navigate_to_dtc_product_setup = lambda: calls.append(("navigate_to_dtc_product_setup",))
    dtc_driver.fill_dtc_product_form = lambda order: calls.append(("fill_dtc_product_form", order.name))
    dtc_driver.submit_dtc_description_page = lambda: calls.append(("submit_dtc_description_page",))
    dtc_driver.open_dtc_upload_page = lambda: calls.append(("open_dtc_upload_page",))
    dtc_driver.select_card_type_and_upload_pdf = lambda pdf_path: calls.append(("upload_pdf", pdf_path))

    order = SimpleNamespace(name="My Order")
    dtc_driver.execute_drive_thru_cards_order(order=order, pdf_path="/tmp/order.pdf")

    assert calls == [
        ("open_dtc_starting_page",),
        ("wait_for_cloudflare_challenge",),
        ("authenticate_dtc",),
        ("ensure_dtc_publisher_account",),
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


def test_authenticated_selector_matches_current_account_menu() -> None:
    selector = TargetSites.DriveThruCards.value.selectors.authenticated_indicator_selector

    assert "[data-cy='accountMenu']" in selector
    assert "[aria-label='Log Out']" in selector


def test_authenticate_dtc_opens_login_pane_then_waits(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    auth_checks = iter([False, False, True])
    dtc_driver.is_dtc_user_authenticated = lambda: next(auth_checks)
    dtc_driver._click_dtc_login_button = lambda: True
    polling_calls = []
    dtc_driver.click_element_polling = (
        lambda by, selector, timeout=30: polling_calls.append((by, selector, timeout)) or True
    )
    monkeypatch.setattr(time, "sleep", lambda _seconds: None)

    assert dtc_driver.authenticate_dtc() is True
    assert polling_calls[0][0] == By.XPATH
    assert "Go to Log In" in polling_calls[0][1]
    assert polling_calls[0][2] == 15


def test_authenticate_dtc_returns_false_on_timeout(monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver) -> None:
    dtc_driver.is_dtc_user_authenticated = lambda: False
    dtc_driver._click_dtc_login_button = lambda: False
    dtc_driver.click_element_polling = lambda *_args, **_kwargs: False

    time_values = iter([0.0, 301.0])
    monkeypatch.setattr(time, "time", lambda: next(time_values))
    monkeypatch.setattr(time, "sleep", lambda _seconds: None)

    assert dtc_driver.authenticate_dtc() is False


def test_execute_drive_thru_cards_order_raises_when_login_not_completed(dtc_driver: AutofillDriver) -> None:
    dtc_driver.driver = SimpleNamespace()
    dtc_driver.open_dtc_starting_page = lambda: None
    dtc_driver.wait_for_cloudflare_challenge = lambda: None
    dtc_driver.authenticate_dtc = lambda: False
    dtc_driver.navigate_to_dtc_product_setup = lambda: (_ for _ in ()).throw(AssertionError("should not continue"))

    with pytest.raises(Exception, match="login was not completed"):
        dtc_driver.execute_drive_thru_cards_order(order=SimpleNamespace(name="x"), pdf_path="/tmp/x.pdf")


def test_execute_drive_thru_cards_order_wraps_step_failures_with_context(dtc_driver: AutofillDriver) -> None:
    dtc_driver.driver = SimpleNamespace()
    dtc_driver.open_dtc_starting_page = lambda: None
    dtc_driver.wait_for_cloudflare_challenge = lambda: None
    dtc_driver.authenticate_dtc = lambda: True
    dtc_driver.ensure_dtc_publisher_account = lambda: None
    dtc_driver.navigate_to_dtc_product_setup = lambda: (_ for _ in ()).throw(RuntimeError("new UI mismatch"))

    with pytest.raises(Exception, match="step 'navigate_to_dtc_product_setup' failed"):
        dtc_driver.execute_drive_thru_cards_order(order=SimpleNamespace(name="x"), pdf_path="/tmp/x.pdf")


def test_initialise_driver_retries_when_initial_window_is_already_closed(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    created = []

    class FailingDriver:
        def __init__(self) -> None:
            self.quit_called = False

        def set_window_size(self, *_args, **_kwargs) -> None:
            raise sl_exc.NoSuchWindowException("target window already closed")

        def quit(self) -> None:
            self.quit_called = True

    class WorkingDriver:
        def __init__(self) -> None:
            self.calls = []

        def set_window_size(self, width: int, height: int) -> None:
            self.calls.append(("set_window_size", width, height))

        def implicitly_wait(self, seconds: int) -> None:
            self.calls.append(("implicitly_wait", seconds))

        def get(self, url: str) -> None:
            self.calls.append(("get", url))

        def quit(self) -> None:
            self.calls.append(("quit",))

    failing_driver = FailingDriver()
    working_driver = WorkingDriver()
    drivers = [failing_driver, working_driver]

    def fake_browser_factory(**_kwargs):
        driver = drivers.pop(0)
        created.append(driver)
        return driver

    monkeypatch.setattr("src.driver.get_undetected_chrome_driver", fake_browser_factory)
    dtc_driver.starting_url = TargetSites.DriveThruCards.value.starting_url
    monkeypatch.setattr("src.driver.WebDriverWait", lambda *_args, **_kwargs: SimpleNamespace(until=lambda _cond: True))
    monkeypatch.setattr("src.driver.time.sleep", lambda _seconds: None)

    dtc_driver.initialise_driver()

    assert created == [failing_driver, working_driver]
    assert failing_driver.quit_called is True
    assert dtc_driver.driver is working_driver
    assert ("set_window_size", 1200, 900) in working_driver.calls
    assert ("implicitly_wait", 5) in working_driver.calls
    assert ("get", TargetSites.DriveThruCards.value.starting_url) in working_driver.calls


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
        (By.CSS_SELECTOR, TargetSites.DriveThruCards.value.selectors.publisher_ready_selector, 1),
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


def test_wait_for_cloudflare_challenge_raises_on_timeout(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    dtc_driver._is_site_loaded = lambda: False
    dtc_driver._is_cloudflare_challenge_active = lambda: False
    time_values = iter([0.0, 2.0])
    monkeypatch.setattr(time, "time", lambda: next(time_values))

    with pytest.raises(TimeoutError, match="did not finish loading"):
        dtc_driver.wait_for_cloudflare_challenge(timeout_seconds=1)


def test_ensure_dtc_publisher_account_automates_wizard(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    calls = []

    class PublisherNameInput:
        value = ""

        def clear(self) -> None:
            self.value = ""

        def send_keys(self, value: str) -> None:
            self.value = value

    class AgreementCheckbox:
        clicked = False

        def is_selected(self) -> bool:
            return False

    publisher_name = PublisherNameInput()
    agreement = AgreementCheckbox()
    ready_checks = iter([False, True])
    dtc_driver.is_dtc_publisher_ready = lambda: next(ready_checks)
    dtc_driver.driver = SimpleNamespace(get=lambda url: calls.append(("get", url)))

    def fake_click(by: By, selector: str, timeout: int = 30) -> bool:
        calls.append(("click", by, selector, timeout))
        return True

    dtc_driver.click_element_polling = fake_click

    def fake_click_with_retry(element) -> bool:
        element.clicked = True
        return True

    dtc_driver.click_element_with_retry = fake_click_with_retry

    class FakeWait:
        count = 0

        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def until(self, condition):
            FakeWait.count += 1
            if FakeWait.count == 1:
                return publisher_name
            if FakeWait.count == 2:
                return agreement
            return condition(dtc_driver.driver)

    monkeypatch.setattr("src.driver.WebDriverWait", FakeWait)

    dtc_driver.ensure_dtc_publisher_account()

    assert calls[0] == ("get", "https://www.drivethrucards.com/joinchoice.php")
    assert len([call for call in calls if call[0] == "click"]) == 3
    assert publisher_name.value == "MPC Autofill Publisher"
    assert agreement.clicked is True


def test_open_dtc_upload_page_extracts_window_open_url(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
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
        (
            "window.location.href = arguments[0];",
            "https://tools.drivethrucards.com/pub_upload_podcard_files.php?products_id=123",
        )
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
            if by == By.CSS_SELECTOR and selector == selectors.authenticated_indicator_selector:
                return []
            if by == By.CSS_SELECTOR and selector == selectors.publisher_ready_selector:
                return []
            return []

    fake_driver = FakeWebDriver()
    dtc_driver.driver = fake_driver

    assert dtc_driver._is_site_loaded() is True
    assert fake_driver.wait_values == [0, 5]


def test_create_driver_uses_undetected_chrome_for_dtc(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    captured = {}

    def fake_undetected_chrome(**kwargs):
        captured.update(kwargs)
        return "uc-driver"

    monkeypatch.setattr("src.driver.get_undetected_chrome_driver", fake_undetected_chrome)
    dtc_driver.browser_profile_path = "/tmp/profile"
    dtc_driver.browser_profile_name = "Profile 7"

    assert dtc_driver.create_driver() == "uc-driver"
    assert captured == {
        "headless": False,
        "binary_location": None,
        "user_data_dir": "/tmp/profile",
        "profile_directory": "Profile 7",
    }


def test_create_driver_uses_standard_factory_for_other_sites(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(AutofillDriver, "__attrs_post_init__", lambda self: None)
    monkeypatch.setattr(
        "src.driver.get_undetected_chrome_driver",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("undetected-chromedriver must not be used here")),
    )
    captured = {}

    def fake_factory(headless=False, binary_location=None):
        captured.update(headless=headless, binary_location=binary_location)
        return "standard-driver"

    autofill_driver = AutofillDriver(
        target_site=TargetSites.MakePlayingCards,
        browser=SimpleNamespace(value=fake_factory, name="chrome"),
    )

    assert autofill_driver.create_driver() == "standard-driver"
    assert captured == {"headless": False, "binary_location": None}


class _FakeElement:
    def __init__(self, selected: bool = False) -> None:
        self.sent: list = []
        self._selected = selected

    def clear(self) -> None:
        pass

    def send_keys(self, value: str) -> None:
        self.sent.append(value)

    def is_selected(self) -> bool:
        return self._selected

    def get_attribute(self, _name: str) -> str:
        return ""


def _timing_out_wait(*_args, **_kwargs) -> SimpleNamespace:
    return SimpleNamespace(until=lambda _cond: (_ for _ in ()).throw(sl_exc.TimeoutException("no element")))


def test_fill_dtc_product_form_raises_when_title_field_is_missing(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    dtc_driver.driver = SimpleNamespace()
    monkeypatch.setattr("src.driver.WebDriverWait", _timing_out_wait)

    with pytest.raises(sl_exc.TimeoutException):
        dtc_driver.fill_dtc_product_form(order=SimpleNamespace(name="x"))


def test_fill_dtc_product_form_raises_when_filter_checkbox_cannot_be_checked(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    dtc_driver.driver = SimpleNamespace(find_element=lambda _by, _value: _FakeElement(selected=False))
    monkeypatch.setattr(
        "src.driver.WebDriverWait", lambda *_args, **_kwargs: SimpleNamespace(until=lambda _cond: _FakeElement())
    )
    dtc_driver.click_element_with_retry = lambda _element: False

    with pytest.raises(Exception, match="filter checkbox"):
        dtc_driver.fill_dtc_product_form(order=SimpleNamespace(name="x"))


def test_submit_dtc_description_page_raises_when_button_is_missing(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    dtc_driver.driver = SimpleNamespace()
    monkeypatch.setattr("src.driver.WebDriverWait", _timing_out_wait)

    with pytest.raises(sl_exc.TimeoutException):
        dtc_driver.submit_dtc_description_page()


def test_open_dtc_upload_page_raises_when_upload_url_cannot_be_extracted(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    button_without_url = SimpleNamespace(get_attribute=lambda _name: "showError(); return false;")
    dtc_driver.driver = SimpleNamespace()
    monkeypatch.setattr(
        "src.driver.WebDriverWait", lambda *_args, **_kwargs: SimpleNamespace(until=lambda _cond: button_without_url)
    )

    with pytest.raises(Exception, match="upload page URL"):
        dtc_driver.open_dtc_upload_page()


def test_select_card_type_and_upload_pdf_raises_when_euro_poker_option_is_missing(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver
) -> None:
    dtc_driver.driver = SimpleNamespace(find_element=lambda _by, _value: _FakeElement())
    monkeypatch.setattr(
        "src.driver.WebDriverWait", lambda *_args, **_kwargs: SimpleNamespace(until=lambda _cond: _FakeElement())
    )
    monkeypatch.setattr(
        "src.driver.Select", lambda _element: SimpleNamespace(options=[SimpleNamespace(text="Jumbo Card(s)")])
    )

    with pytest.raises(Exception, match="Euro Poker"):
        dtc_driver.select_card_type_and_upload_pdf(pdf_path="/tmp/order.pdf")


def test_select_card_type_and_upload_pdf_raises_when_pdf_is_missing(
    monkeypatch: pytest.MonkeyPatch, dtc_driver: AutofillDriver, tmp_path
) -> None:
    euro_poker_select = SimpleNamespace(
        options=[SimpleNamespace(text="Premium Euro Poker Card(s)")],
        select_by_visible_text=lambda _text: None,
    )
    dtc_driver.driver = SimpleNamespace(find_element=lambda _by, _value: _FakeElement())
    monkeypatch.setattr(
        "src.driver.WebDriverWait", lambda *_args, **_kwargs: SimpleNamespace(until=lambda _cond: _FakeElement())
    )
    monkeypatch.setattr("src.driver.Select", lambda _element: euro_poker_select)

    with pytest.raises(Exception, match="PDF file not found"):
        dtc_driver.select_card_type_and_upload_pdf(pdf_path=str(tmp_path / "does-not-exist.pdf"))


def test_initialise_bars_creates_only_status_bar_for_dtc(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(AutofillDriver, "__attrs_post_init__", lambda self: None)

    dtc = AutofillDriver(target_site=TargetSites.DriveThruCards)
    dtc.initialise_bars()
    assert dtc.status_bar
    assert dtc.order_progress_bar is None
    assert dtc.download_bar is None
    assert dtc.upload_bar is None

    mpc = AutofillDriver(target_site=TargetSites.MakePlayingCards)
    mpc.initialise_bars()
    assert mpc.status_bar
    assert mpc.order_progress_bar is not None
    assert mpc.download_bar is not None
    assert mpc.upload_bar is not None
