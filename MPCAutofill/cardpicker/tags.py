"""
Tags for cards.
"""

import re
from typing import Optional

from cardpicker import models
from cardpicker.constants import NSFW


class Tags:
    def __init__(self) -> None:
        self.tags = self.get_tags()
        self.canonical_cards = self.get_canonical_cards()

    @classmethod
    def get_tags(cls) -> dict[str, "models.Tag"]:
        return {
            tag.name.lower(): tag for tag in [models.Tag(name=NSFW, aliases=[], parent=None), *models.Tag.objects.all()]
        }

    @classmethod
    def get_canonical_cards(cls) -> dict[str, int]:
        return {
            f"{expansion_code.upper()} {collector_number}": pk
            for (expansion_code, collector_number, pk) in models.CanonicalCard.objects.values_list(
                "expansion__code", "collector_number", "pk"
            )
        }

    @classmethod
    def extract_tag_parts(cls, name: str) -> set[str]:
        tag_parts = re.findall(r"\(([^\(\)]+)\)|\[([^\[\]]+)\]", name)  # Get content of () and []
        return set(map(lambda x: x[0] if len(x[0]) != 0 else x[1], tag_parts))

    def match_canonical_card(self, raw_tags: set[str]) -> tuple[str, int] | None:
        men = {man for man in raw_tags if man in self.canonical_cards.keys()}
        if len(men) == 1:
            tag = men.pop()
            return tag, self.canonical_cards[tag]
        elif len(men) > 1:
            # multiple matches, ambiguous -> no match
            return None
        else:
            return None

    @classmethod
    def remove_tag_from_name(cls, name: str, tag: str) -> str:
        name_with_no_tags = name  # mutated below
        escaped_raw_tag = re.escape(tag)
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
        return name_with_no_tags

    def extract(self, name: Optional[str]) -> tuple[str, set[str], int | None]:
        """
        This function unpacks a folder or image name which contains a name component and some number of tags
        into its constituents.
        Tags are wrapped in either [square brackets] or (parentheses), and any combination of [] and () can be used
        within a single name.
        """

        if not name:
            return "", set(), None

        tag_set: set[str] = set()
        name_with_no_tags = name  # tags will be removed from this name below
        raw_tags = {y for tag_part in self.extract_tag_parts(name) for y in [x.strip() for x in tag_part.split(",")]}
        match = self.match_canonical_card(raw_tags=raw_tags)
        canonical_card_pk: int | None = None
        if match:
            canonical_card_tag, canonical_card_pk = match
            name_with_no_tags = self.remove_tag_from_name(name_with_no_tags, canonical_card_tag)

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
            name_with_no_tags = self.remove_tag_from_name(name_with_no_tags, raw_tag)

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
        return name_with_no_tags, tag_set, canonical_card_pk


__all__ = ["Tags"]
