"""
Tags for cards.
"""

import functools
import re
from typing import Optional

from aenum import MultiValueEnum, extend_enum

from cardpicker import models


class Tag(str, MultiValueEnum):
    ALT_ART = "Alt Art", "Alternative Art", "Alternate Art", "Alt"
    EXTENDED = "Extended", "EXTENDED Art"
    FULL_ART = "Full Art", "FULL ART", "Fullart", "Full"
    NSFW = "NSFW", "Nsfw"

    @staticmethod
    def extract_name_and_tags(name: Optional[str]) -> tuple[str, set[str]]:
        """
        This function unpacks a folder or image name which contains a name component and some number of tags
        into its constituents.
        Tags are wrapped in either [square brackets] or (parentheses), and any combination of [] and () can be used
        within a single name.
        """

        if not name:
            return "", set()

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
                    tag_set.add(Tag(raw_tag.strip().title()))
                except ValueError:
                    pass  # Unknown tag

        return name_with_no_tags, {x.value for x in tag_set}


def read_tags_in_database() -> None:
    """
    Extend the tag recognition system to include tags defined in the `Tag` table.
    """

    for tag in models.Tag.get_tags():
        try:
            extend_enum(Tag, tag.title(), tag.title())
        except TypeError:  # aenum will raise this if the tag is already in the enum
            pass
