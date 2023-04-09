import os
import sys
import time
from math import floor
from typing import TYPE_CHECKING, Any, Callable, Optional, TypeVar, cast
from xml.etree import ElementTree
from xml.etree.ElementTree import Element

import numpy as np
import ratelimit
import requests
from selenium.common.exceptions import NoAlertPresentException, NoSuchWindowException

import src.constants as constants

if TYPE_CHECKING:
    from driver import AutofillDriver

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


CURRDIR: str = os.path.dirname(os.path.realpath(sys.executable)) if getattr(sys, "frozen", False) else os.getcwd()

TEXT_BOLD = "\033[1m"
TEXT_END = "\033[0m"


class InvalidStateException(Exception):
    # TODO: recovery from invalid state?
    def __init__(self, state: str, expected_state: str):
        self.message = (
            f"Expected the driver to be in the state {TEXT_BOLD}{expected_state}{TEXT_END} but the driver is in the "
            f"state {TEXT_BOLD}{state}{TEXT_END}"
        )
        super().__init__(self.message)


class ValidationException(Exception):
    pass


@ratelimit.sleep_and_retry  # type: ignore  # `ratelimit` does not implement decorator typing correctly
@ratelimit.limits(calls=1, period=0.1)  # type: ignore  # `ratelimit` does not implement decorator typing correctly
def rate_limit_post_api_call(url: str, data: dict[str, Any], timeout: Optional[int] = None) -> requests.Response:
    with requests.post(url, data=data, timeout=timeout) as r_info:
        return r_info


def safe_post_api_call(
    url: str, data: dict[str, Any], expected_keys: set[str], max_tries: int = 3, timeout: Optional[int] = None
) -> Optional[dict[str, Any]]:
    tries = 0
    while True:
        try:
            r_info = rate_limit_post_api_call(url=url, data=data, timeout=timeout)
            r_json = r_info.json()
            # validate contents of response
            if (
                r_info.status_code != 500
                and len(expected_keys - r_json.keys()) == 0
                and not any([bool(r_json[x]) is False for x in expected_keys])
            ):
                return r_json
        except (requests.exceptions.RequestException, TimeoutError):
            pass

        tries += 1
        if tries >= max_tries:
            return None


def get_google_drive_file_name(drive_id: str) -> Optional[str]:
    """
    Retrieve the name for the Google Drive file identified by `drive_id`.
    """

    if not drive_id:
        return None
    response = safe_post_api_call(
        url=constants.GoogleScriptsAPIs.image_name, data={"id": drive_id}, timeout=30, expected_keys={"name"}
    )
    return response["name"] if response is not None else None


def download_google_drive_file(drive_id: str, file_path: str) -> bool:
    """
    Download the Google Drive file identified by `drive_id` to the specified `file_path`.
    Returns whether the request was successful or not.
    """

    response = safe_post_api_call(
        url=constants.GoogleScriptsAPIs.image_content, data={"id": drive_id}, timeout=5 * 60, expected_keys={"result"}
    )
    if response is not None:
        file_contents = response["result"]
        if len(file_contents) > 0:
            # Download the image
            with open(file_path, "wb") as f:
                f.write(np.array(file_contents, dtype=np.uint8))
                return True
    return False


def text_to_list(input_text: str) -> list[int]:
    """
    Helper function to translate strings like "[2, 4, 5, 6]" into sorted lists.
    """

    if not input_text:
        return []
    return sorted([int(x) for x in input_text.strip("][").replace(" ", "").split(",")])


def unpack_element(element: ElementTree.Element, tags: list[str]) -> dict[str, ElementTree.Element]:
    """
    Unpacks `element` according to expected tags. Expected tags that don't have elements in `element` have
    value None in the return dictionary.
    """

    return {tag: Element(tag) for tag in tags} | {item.tag: item for item in element}


def image_directory() -> str:
    cards_folder = os.path.join(CURRDIR, "cards")
    if not os.path.exists(cards_folder):
        os.mkdir(cards_folder)
    return cards_folder


def file_exists(file_path: Optional[str]) -> bool:
    return file_path is not None and file_path != "" and os.path.isfile(file_path) and os.path.getsize(file_path) > 0


def alert_handler(func: F) -> F:
    """
    Function decorator which accepts an alert in the given Selenium driver if one is raised by the decorated function.
    """

    def wrapper(*args: Any, **kwargs: dict[str, Any]) -> F:
        try:
            autofill_driver: "AutofillDriver" = args[0]
            alert = autofill_driver.driver.switch_to.alert
            alert.accept()
        except (NoAlertPresentException, NoSuchWindowException):
            pass
        return func(*args, **kwargs)

    return cast(F, wrapper)


def time_to_hours_minutes_seconds(t: float) -> tuple[int, int, int]:
    hours = int(floor(t / 3600))
    mins = int(floor(t / 60) - hours * 60)
    secs = int(t - (mins * 60) - (hours * 3600))
    return hours, mins, secs


def log_hours_minutes_seconds_elapsed(t0: float) -> None:
    hours, mins, secs = time_to_hours_minutes_seconds(time.time() - t0)
    print("Elapsed time: ", end="")
    if hours > 0:
        print(f"{hours} hour{'s' if hours != 1 else ''}, ", end="")
    print(f"{mins} minute{'s' if mins != 1 else ''} and {secs} second{'s' if secs != 1 else ''}.")


def remove_directories(directory_list: list[str]) -> None:
    for directory in directory_list:
        try:
            os.rmdir(directory)
        except Exception:
            pass


def remove_files(file_list: list[str]) -> None:
    for file in file_list:
        try:
            os.remove(file)
        except Exception:
            pass
