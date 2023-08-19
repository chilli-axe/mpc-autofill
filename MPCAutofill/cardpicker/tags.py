"""
Tags for cards.
"""

import functools
import re
from typing import Optional

from aenum import MultiValueEnum


class Tag(str, MultiValueEnum):
    ALT_ART = "ALT ART", "ALTART", "ALT"
    EXTENDED = "EXTENDED"
    FULL_ART = "FULL ART", "FULLART", "FULL"
    NSFW = "NSFW"

    @staticmethod
    def extract_name_and_tags(name: Optional[str]) -> tuple[str, list[str]]:
        """
        This function unpacks a folder or image name which contains a name component and some number of tags
        into its constituents.
        Tags are wrapped in either [square brackets] or (parentheses), and any combination of [] and () can be used
        within a single name.
        """

        if not name:
            return "", []

        tag_set = set()  # Use set to not have duplicate tags
        tag_parts = re.findall(r"\(([^\(\)]+)\)|\[([^\[\]]+)\]", name)  # Get content of () and []
        cleaned_parts = list(map(lambda x: x[0] if len(x[0]) != 0 else x[1], tag_parts))
        name_with_no_tags = functools.reduce(
            lambda mutated_name, tag: mutated_name.replace(f"[{tag}]", "").replace(f"({tag})", "").strip(),
            [name, *cleaned_parts],
        )
        for tag_part in cleaned_parts:
            raw_tags = tag_part.split(",")
            for raw_tag in raw_tags:
                try:
                    tag_set.add(Tag(raw_tag.strip().upper()))
                except ValueError:
                    pass  # Unknown tag

        return name_with_no_tags, [x.value for x in tag_set]
