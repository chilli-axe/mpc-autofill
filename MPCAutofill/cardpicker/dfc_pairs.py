import json
import time
from typing import Any

import ratelimit
import requests
from bulk_sync import bulk_sync

from cardpicker.constants import DFC_URL, MELD_URL
from cardpicker.models import DFCPair
from cardpicker.utils.to_searchable import to_searchable


@ratelimit.sleep_and_retry  # type: ignore  # `ratelimit` does not implement decorator typing correctly
@ratelimit.limits(calls=1, period=0.1)  # type: ignore  # `ratelimit` does not implement decorator typing correctly
def query_scryfall(url: str) -> dict[str, Any]:
    return json.loads(requests.get(url).content)


def query_scryfall_paginated(url: str) -> list[dict[str, Any]]:
    response = query_scryfall(url)
    data = response["data"]
    while response["has_more"]:
        response = query_scryfall(response["next_page"])
        data += response["data"]
    return data


def sync_dfcs() -> None:
    t0 = time.time()
    print("Querying Scryfall for DFC pairs...")
    dfc_pairs: list[DFCPair] = []

    # query data and construct objects for regular double-faced cards
    dfc_data = query_scryfall_paginated(DFC_URL)
    print(f"Identified {len(dfc_data)} double-faced cards")
    for item in dfc_data:

        if item["digital"] is True:
            continue

        front_name = item["card_faces"][0]["name"]
        back_name = item["card_faces"][1]["name"]
        dfc_pairs.append(
            DFCPair(
                front=front_name,
                front_searchable=to_searchable(front_name),
                back=back_name,
                back_searchable=to_searchable(back_name),
            )
        )

    # query data and construct objects for meld pairs
    meld_data = query_scryfall_paginated(MELD_URL)
    print(f"Identified {len(meld_data)} meld pieces")
    for item in meld_data:
        card_part_singleton_list = list(filter(lambda part: part["name"] == item["name"], item["all_parts"]))
        meld_result_singleton_list = list(filter(lambda part: part["component"] == "meld_result", item["all_parts"]))

        if len(card_part_singleton_list) != 1 or len(meld_result_singleton_list) != 1:
            continue

        card_part = card_part_singleton_list.pop()
        meld_result = meld_result_singleton_list.pop()["name"]
        if card_part["component"] == "meld_part":
            is_top = "\n(Melds with " not in item["oracle_text"]
            card_bit = "Top" if is_top else "Bottom"
            dfc_pairs.append(
                DFCPair(
                    front=item["name"],
                    front_searchable=to_searchable(item["name"]),
                    back=f"{meld_result} ({card_bit})",
                    back_searchable=to_searchable(f"{meld_result} {card_bit}"),
                )
            )

    # synchronise DFCPair objects to database
    key_fields = ("front",)
    bulk_sync(new_models=dfc_pairs, key_fields=key_fields, filters=None, db_class=DFCPair)
    print(f"Finished synchronising database with Scryfall DFCs, which took {(time.time() - t0):.2f} seconds.")
