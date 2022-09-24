from dataclasses import dataclass
from enum import Enum
from types import DynamicClassAttribute

from cardpicker.sources.source_types import SourceTypeChoices


@dataclass
class TestCard:
    identifier: str
    name: str


@dataclass
class TestSource:
    key: str
    name: str
    identifier: str
    source_type: SourceTypeChoices


class TestCards(Enum):
    BRAINSTORM = TestCard(identifier="1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5", name="Brainstorm")
    ISLAND = TestCard(identifier="1IDtqSjJ4Yo45AnNA4SplOiN7ewibifMa", name="Island")
    ISLAND_CLASSICAL = TestCard(identifier="1HsvTYs1jFGe1c8U1PnNZ9aB8jkAW7KU0", name="Island (William Bradford)")
    SIMPLE_CUBE = TestCard(identifier="1JtXL6Ca9nQkvhwZZRR9ZuKA9_DzsFf1V", name="Simple Cube")  # default back
    HUNTMASTER_OF_THE_FELLS = TestCard(identifier="", name="Huntmaster of the Fells")
    RAVAGER_OF_THE_FELLS = TestCard(identifier="", name="Ravager of the Fells")

    @DynamicClassAttribute
    def value(self) -> TestCard:
        return self._value_


class TestSources(Enum):
    EXAMPLE_DRIVE_1 = TestSource(
        key="example_drive_1",
        name="Example Drive 1",
        identifier="1Fu2nEymZhCpOOZkfF0XoZsVqdIWmPdNq",
        source_type=SourceTypeChoices.GOOGLE_DRIVE,
    )
    EXAMPLE_DRIVE_2 = TestSource(
        key="example_drive_2",
        name="Example Drive 2",
        identifier="18wZl7T9DU_lf2X5xYFiyH6pATVy8ZlOd",
        source_type=SourceTypeChoices.GOOGLE_DRIVE,
    )

    @DynamicClassAttribute
    def value(self) -> TestSource:
        return self._value_
