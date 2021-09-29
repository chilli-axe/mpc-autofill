import os
import sys
from functools import wraps
from platform import system
from typing import TYPE_CHECKING, Dict, List, Union
from xml.etree import ElementTree

from selenium import webdriver
from selenium.common.exceptions import (NoAlertPresentException,
                                        UnexpectedAlertPresentException)

if TYPE_CHECKING:
    from driver import AutofillDriver


# IS_WINDOWS: bool = system() == "Windows"
CURRDIR: str = (
    os.path.dirname(os.path.realpath(sys.executable))
    if getattr(sys, "frozen", False)
    else os.getcwd()
)

TEXT_BOLD = "\033[1m"
TEXT_END = "\033[0m"


class InvalidStateException(Exception):
    # TODO: recovery from invalid state?
    def __init__(self, state, expected_state):
        self.message = (
            f"Expected the driver to be in the state {TEXT_BOLD}{expected_state}{TEXT_END} but the driver is in the "
            f"state {TEXT_BOLD}{state}{TEXT_END}"
        )
        super().__init__(self.message)


class ValidationException(Exception):
    pass


def text_to_list(input_text: str) -> List[int]:
    """
    Helper function to translate strings like "[2, 4, 5, 6]" into lists
    """

    if not input_text:
        return []
    return sorted([int(x) for x in input_text.strip("][").replace(" ", "").split(",")])


def unpack_element(
    element: ElementTree.Element, tags: List[str], unpack_to_text=False
) -> Union[Dict[str, ElementTree.Element], Dict[str, str]]:
    """
    Unpacks `element` according to expected tags. Expected tags that don't have elements in `element` have
    value None in the return dictionary.
    If `unpack_to_text` is specified, returns the text of each element rather than the elements themselves.
    """

    element_dict = {x: None for x in tags}
    for x in element:
        if unpack_to_text:
            element_dict[x.tag] = x.text
        else:
            element_dict[x.tag] = x
    return element_dict


def file_exists(file_path: str) -> bool:
    return (
        file_path != "" and os.path.isfile(file_path) and os.path.getsize(file_path) > 0
    )


def alert_handler(func):
    """
    Function decorator which accepts an alert in the given Selenium driver if one is raised.
    TODO: this doesn't seem to work properly?
    """

    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except UnexpectedAlertPresentException:
            try:
                autofill_driver: "AutofillDriver" = args[0]
                alert = autofill_driver.driver.switch_to.alert
                alert.accept()
            except NoAlertPresentException:
                pass

    return wrapper
