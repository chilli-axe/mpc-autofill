DFC_SCRYFALL_QUERY = "is:dfc -layout:art_series -(layout:double_faced_token -keyword:transform) -is:reversible"
MELD_SCRYFALL_QUERY = "is:meld"
DFC_SCRYFALL_URL = f"https://api.scryfall.com/cards/search?q={DFC_SCRYFALL_QUERY}"
MELD_SCRYFALL_URL = f"https://api.scryfall.com/cards/search?q={MELD_SCRYFALL_QUERY}"

DATE_FORMAT = "jS F, Y"

PAGE_SIZE = 10

NEW_CARDS_PAGE_SIZE = 12
NEW_CARDS_DAYS = 14
SEARCH_RESULTS_PAGE_SIZE = 300
CARDS_PAGE_SIZE = 1000

MAX_SIZE_MB = 30
