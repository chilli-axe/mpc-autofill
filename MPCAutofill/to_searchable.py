import re
import string
import unicodedata


def to_searchable(input_str):
    if not input_str:
        return ""
    
    # Convert a card name to a search-friendly string
    # First, convert to unicode to ignore accents and other unusual characters, and convert to lowercase
    input_str = unicodedata.normalize('NFD', input_str).encode('ascii', 'ignore').decode('utf8').lower()

    # Remove text inside brackets
    input_str = re.sub("[\(\[].*?[\)\]]", "", input_str)

    # Remove hyphens and the word "the"
    input_str = input_str.replace("-", " ").replace(" the ", " ").replace("the ", "")

    # Remove punctuation
    input_str = input_str.translate(str.maketrans('', '', string.punctuation))

    # Remove all digits
    input_str = input_str.translate(str.maketrans('', '', string.digits))

    # Remove all words from this list
    to_remove = [
        "Boxtopper",
        "Border",
        "\"Constellation\"",
        "Fullart",
    ]
    for x in to_remove:
        input_str = input_str.replace(x.lower(), "")

    # Fix whitespace
    input_str = ' '.join([x for x in input_str.split(" ") if x]).strip()
    return input_str
