import time
from math import floor
from typing import TYPE_CHECKING, Any, Callable, TypeVar, cast
from xml.etree import ElementTree
from xml.etree.ElementTree import Element

from selenium.common.exceptions import NoAlertPresentException, NoSuchWindowException

if TYPE_CHECKING:  # necessary to avoid circular import
    from driver import AutofillDriver

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


TEXT_BOLD = "\033[1m"
TEXT_END = "\033[0m"


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
