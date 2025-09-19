import sys
import time
from math import floor
from typing import TYPE_CHECKING, Any, Callable, Optional, TypeVar, cast
from xml.etree import ElementTree
from xml.etree.ElementTree import Element

from InquirerPy import inquirer
from selenium.common.exceptions import (
    NoAlertPresentException,
    NoSuchWindowException,
    UnexpectedAlertPresentException,
)

from src.formatting import bold
from src.logging import logger

if TYPE_CHECKING:  # necessary to avoid circular import
    from driver import AutofillDriver

# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
F = TypeVar("F", bound=Callable[..., Any])


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

    def wrapper(*args: Any, **kwargs: dict[str, Any]) -> Optional[F]:
        autofill_driver: "AutofillDriver" = args[0]
        try:
            alert = autofill_driver.driver.switch_to.alert
            alert.accept()
        except (NoAlertPresentException, NoSuchWindowException):
            pass
        try:
            return func(*args, **kwargs)
        except UnexpectedAlertPresentException:
            alert = autofill_driver.driver.switch_to.alert
            alert.accept()
        except (NoAlertPresentException, NoSuchWindowException):
            pass
        return None

    return cast(F, wrapper)


def exception_retry_skip_handler(func: F) -> F:
    """
    Context manager for handling uncaught exceptions by allowing the user to skip or retry the function's logic.
    """

    def wrapper(*args: Any, **kwargs: dict[str, Any]) -> Optional[F]:
        while True:
            try:
                return func(*args, **kwargs)
            except AssertionError as e:
                raise e
            except Exception as e:
                logger.exception("Uncaught exception")
                logger.info(f"An uncaught exception occurred:\n{bold(e)}\n")
                action = inquirer.select(
                    message="How should the tool proceed?",
                    choices=["Retry this action", "Skip this action", "Terminate"],
                ).execute()
                if action == "Retry this action":
                    continue
                elif action == "Terminate":
                    sys.exit(0)
                else:
                    return None

    return cast(F, wrapper)


def time_to_hours_minutes_seconds(t: float) -> tuple[int, int, int]:
    hours = int(floor(t / 3600))
    mins = int(floor(t / 60) - hours * 60)
    secs = int(t - (mins * 60) - (hours * 3600))
    return hours, mins, secs


def log_hours_minutes_seconds_elapsed(t0: float) -> None:
    hours, mins, secs = time_to_hours_minutes_seconds(time.time() - t0)
    time_elapsed_string = (
        "Elapsed time: "
        + (f"{hours} hour{'s' if hours != 1 else ''}, " if hours > 0 else "")
        + f"{mins} minute{'s' if mins != 1 else ''} and {secs} second{'s' if secs != 1 else ''}."
    )
    logger.info(time_elapsed_string)
