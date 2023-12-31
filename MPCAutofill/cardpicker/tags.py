"""
Tags for cards.
"""

import re
from typing import Optional

from cardpicker import models
from cardpicker.constants import NSFW


class Tags:
    def __init__(self) -> None:
        self.tags = {
            tag.name.lower(): tag for tag in [models.Tag(name=NSFW, aliases=[], parent=None), *models.Tag.objects.all()]
        }

    def extract_name_and_tags(self, name: Optional[str]) -> tuple[str, set[str]]:
        """
        This function unpacks a folder or image name which contains a name component and some number of tags
        into its constituents.
        Tags are wrapped in either [square brackets] or (parentheses), and any combination of [] and () can be used
        within a single name.
        """

        if not name:
            return "", set()

        tag_set: set[str] = set()
        tag_parts = re.findall(r"\(([^\(\)]+)\)|\[([^\[\]]+)\]", name)  # Get content of () and []
        cleaned_parts = list(map(lambda x: x[0] if len(x[0]) != 0 else x[1], tag_parts))
        name_with_no_tags = name  # tags will be removed from this name below
        for tag_part in cleaned_parts:
            raw_tags = [x.strip() for x in tag_part.split(",")]
            for raw_tag in raw_tags:
                lowercase_tag = raw_tag.lower()

                # identify if this is a valid tag. if it is, add the tag's name to the set
                tag_object: Optional[models.Tag] = None
                if lowercase_tag in self.tags.keys():
                    tag_object = self.tags[lowercase_tag]
                else:
                    for tag in self.tags.values():
                        if lowercase_tag in [alias.lower() for alias in tag.aliases]:
                            tag_object = tag
                            break
                if tag_object is None:
                    continue
                tag_set.add(tag_object.name)

                # `tag_object` also implies all of its parents
                current_tag = tag_object
                while current_tag.parent is not None:
                    tag_set.add(current_tag.parent.name)
                    current_tag = current_tag.parent

                # this is a little ugly. remove all instances of `raw_tag` inside () or [] in the name.
                escaped_raw_tag = re.escape(raw_tag)
                while True:
                    match = re.search(
                        rf"\(.*({escaped_raw_tag},? *).*.*?\)|\[.*({escaped_raw_tag},? *).*.*?\]", name_with_no_tags
                    )
                    if match is None or not any(match.groups()):
                        break
                    for i, group in enumerate(match.groups()):
                        if group is not None:
                            start, end = match.start(i + 1), match.end(i + 1)
                            if start > 0 and end > 0:
                                name_with_no_tags = name_with_no_tags[0:start] + name_with_no_tags[end:]

        artifacts: list[tuple[str, str]] = [  # remove these extra bits from the name
            ("( )", ""),
            ("()", ""),
            ("[ ]", ""),
            ("[]", ""),
            ("[, ", "["),
            (", ]", "]"),
            ("(, ", "("),
            (", )", ")"),
        ]
        for artifact, replacement in artifacts:
            name_with_no_tags = name_with_no_tags.replace(artifact, replacement)
        return name_with_no_tags, tag_set


__all__ = ["Tags"]
