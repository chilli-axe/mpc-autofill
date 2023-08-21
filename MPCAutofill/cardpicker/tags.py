"""
Tags for cards.
"""

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
        name_with_no_tags = name  # tags will be removed from this name below
        for tag_part in cleaned_parts:
            raw_tags = tag_part.split(",")
            for raw_tag in raw_tags:
                try:
                    tag_enum_object = Tag(raw_tag.strip().title())
                    tag_set.add(tag_enum_object)
                    name_with_no_tags = (
                        name_with_no_tags.replace(f"[{raw_tag}]", "").replace(f"({raw_tag})", "").strip()
                    )
                except ValueError:
                    pass  # Unknown tag

        return name_with_no_tags, {x.value for x in tag_set}


def read_tags_in_database() -> None:
    """
    Extend the tag recognition system to include tags defined in the `Tag` table.
    """

    for tag, aliases in models.Tag.get_tags().items():
        try:
            extend_enum(Tag, tag.title(), tag.title(), *[alias.title() for alias in aliases])
        except TypeError:  # aenum will raise this if the tag is already in the enum
            pass
