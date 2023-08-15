import json

import requests

from cardpicker.constants import DFC_SCRYFALL_URL, MELD_SCRYFALL_URL


class TestUpdateDFCs:
    # region tests
    def test_scryfall_queries(self) -> None:
        assert (response := requests.get(DFC_SCRYFALL_URL)).status_code == 200 and len(
            json.loads(response.content)["data"]
        ) > 0
        assert (response := requests.get(MELD_SCRYFALL_URL)).status_code == 200 and len(
            json.loads(response.content)["data"]
        ) > 0

    # endregion
