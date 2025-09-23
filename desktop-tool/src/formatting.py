from typing import Any

TEXT_BOLD = "\033[1m"
TEXT_END = "\033[0m"


def bold(text: Any) -> str:
    return f"{TEXT_BOLD}{text}{TEXT_END}"


def text_to_set(input_text: str) -> set[int]:
    """
    Helper function to translate strings like "[2, 4, 5, 6]" into sets.
    """

    if not input_text:
        return set()
    return set([int(x) for x in input_text.strip("][").replace(" ", "").split(",")])
