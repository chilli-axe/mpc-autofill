import re
import string
import unicodedata


def to_searchable(input_str: str) -> str:
    if not input_str:
        return ""

    # Convert a card name to a search-friendly string
    # First, convert to unicode to ignore accents and other unusual characters, and convert to lowercase
    input_str = (
        unicodedata.normalize("NFD", input_str)
        .encode("ascii", "ignore")
        .decode("utf8")
        .lower()
    )

    # Remove text inside brackets
    input_str = re.sub("[\(\[].*?[\)\]]", "", input_str)

    # Remove hyphens and the word "the"
    input_str = input_str.replace("-", " ").replace(" the ", " ")

    # If the string begins with the word "the", remove it
    if input_str.startswith("the "):
        input_str = input_str[4:]

    # Remove punctuation
    input_str = input_str.translate(str.maketrans("", "", string.punctuation))

    # Remove all digits
    input_str = input_str.translate(str.maketrans("", "", string.digits))

    # Fix whitespace
    input_str = " ".join([x for x in input_str.split(" ") if x]).strip()

    return input_str
