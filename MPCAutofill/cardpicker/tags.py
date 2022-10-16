"""
Tags for cards.
"""
from __future__ import annotations

import re

from aenum import MultiValueEnum


class Tag(str, MultiValueEnum):
    ALT_ART = "ALT ART", "ALTART", "ALT"
    EXTENDED = "EXTENDED"
    FULL_ART = "FULL ART", "FULLART", "FULL"
    NSFW = "NSFW"

    @staticmethod
    def list_from_card_name(card_name: str) -> list[Tag]:
        tag_set = set()
        pattern = r"\(([^\(\)]+)\)|\[([^\[\]]+)\]"  # Get content of () and []
        tag_parts = re.findall(pattern, card_name)
        cleaned_parts = list(map(lambda x: x[0] if len(x[0]) != 0 else x[1], tag_parts))
        for tag_part in cleaned_parts:
            raw_tags = tag_part.split(",")
            for raw_tag in raw_tags:
                try:
                    tag_set.add(Tag(raw_tag.strip().upper()))
                except ValueError:
                    pass  # Unknown tag

        return list(tag_set)
