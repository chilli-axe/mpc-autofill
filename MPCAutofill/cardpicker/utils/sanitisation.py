import re
import string
from typing import Optional


def fix_whitespace(input_str: str) -> str:
    return " ".join([x for x in input_str.split(" ") if x]).strip()


def to_searchable(input_str: str) -> str:
    if not input_str:
        return ""

    # Convert a card name to a search-friendly string
    # First, convert to lowercase
    input_str = input_str.lower()

    # Remove text inside brackets
    input_str = re.sub("[\(\[].*?[\)\]]", "", input_str)

    # Remove hyphens and the word "the" and substitute right apostrophes (’) for single quotes (')
    input_str = input_str.replace("-", " ").replace(" the ", " ").replace("’", "'")

    # If the string begins with the word "the", remove it
    if input_str.startswith("the "):
        input_str = input_str[4:]

    # Remove punctuation
    input_str = input_str.translate(str.maketrans("", "", string.punctuation))

    # Remove all digits
    input_str = input_str.translate(str.maketrans("", "", string.digits))

    # Fix whitespace
    input_str = fix_whitespace(input_str)

    return input_str


def process_line(input_str: str) -> tuple[Optional[str], Optional[int]]:
    # Extract the quantity and card name from a given line of the text input
    input_str = str(" ".join([x for x in input_str.split(" ") if x]))
    if input_str.isspace() or len(input_str) == 0:
        return None, None
    num_idx = 0
    input_str = input_str.replace("//", "&").replace("/", "&")
    while True:
        if num_idx >= len(input_str):
            return None, None
        try:
            int(input_str[num_idx])
            num_idx += 1
        except ValueError:
            if num_idx == 0:
                # no number at the start of the line - assume qty 1
                qty = 1
                name = " ".join(input_str.split(" "))
            else:
                # located the break between qty and name
                try:
                    qty = int(input_str[0 : num_idx + 1].lower().replace("x", ""))
                except ValueError:
                    return None, None
                name = " ".join(x for x in input_str[num_idx + 1 :].split(" ") if x)
            return name, qty
