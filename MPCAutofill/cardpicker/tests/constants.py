from dataclasses import dataclass
from enum import Enum

from cardpicker.sources.source_types import SourceTypeChoices


@dataclass
class Card:
    pk: int
    identifier: str
    name: str
    dpi: int
    size: int


@dataclass
class Source:
    pk: int
    key: str
    name: str
    identifier: str
    source_type: SourceTypeChoices


class Cards(Enum):
    BRAINSTORM = Card(
        pk=0,
        identifier="1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5",
        name="Brainstorm",
        dpi=600,
        size=5_000_000,
    )
    ISLAND = Card(
        pk=1,
        identifier="1IDtqSjJ4Yo45AnNA4SplOiN7ewibifMa",
        name="Island",
        dpi=600,
        size=5_000_000,
    )
    ISLAND_CLASSICAL = Card(
        pk=2,
        identifier="1HsvTYs1jFGe1c8U1PnNZ9aB8jkAW7KU0",
        name="Island (William Bradford)",
        dpi=600,
        size=5_000_000,
    )
    MOUNTAIN = Card(
        pk=3,
        identifier="1-dcs0FEE05MTGiYbKqs9HnRdhXkgtIJG",
        name="Mountain",
        dpi=600,
        size=5_000_000,
    )
    SIMPLE_CUBE = Card(  # this is set as the default back in the `django_settings` fixture
        pk=4,
        identifier="1JtXL6Ca9nQkvhwZZRR9ZuKA9_DzsFf1V",
        name="Simple Cube",
        dpi=300,
        size=2_000_000,
    )
    SIMPLE_LOTUS = Card(
        pk=5,
        identifier="1oigI6wz0zA--pNMuExKTs40kBNH6VRP_",
        name="Simple Lotus",
        dpi=300,
        size=2_000_000,
    )
    HUNTMASTER_OF_THE_FELLS = Card(
        pk=6,
        identifier="1991MWCur9NdAFi-tQQD5YbQj2oqV_WRy",
        name="Huntmaster of the Fells",
        dpi=600,
        size=5_000_000,
    )
    RAVAGER_OF_THE_FELLS = Card(
        pk=7,
        identifier="1lv8WC1Xf1qxA7VHSc8jOtT5up6FwaBPH",
        name="Ravager of the Fells",
        dpi=600,
        size=5_000_000,
    )
    PAST_IN_FLAMES_1 = Card(
        pk=8,
        identifier="1UPdh7J7hScg4ZnxSPJ-EeBYHLp2s3Oz1",
        name="Past in Flames",
        dpi=600,
        size=5_000_000,
    )
    PAST_IN_FLAMES_2 = Card(
        pk=9,
        identifier="1dxSLHtw-VwwE09pZCA8OA6LbuWRZPEoU",
        name="Past in Flames",
        dpi=400,  # note: the DPI of the card on the test google drive is 600; set to 400 here for testing DPI filtering
        size=4_000_000,
    )
    DELVER_OF_SECRETS = Card(
        pk=10,
        identifier="17fopRCNRge72U8Hac8pApHZtEalx5kHy",
        name="Delver of Secrets",
        dpi=600,
        size=5_000_000,
    )
    INSECTILE_ABERRATION = Card(
        pk=11,
        identifier="1mO73GTYlieP0kiZEkF58pJSrZTmC9lNh",
        name="Insectile Aberration",
        dpi=600,
        size=5_000_000,
    )
    GOBLIN = Card(  # token
        pk=12,
        identifier="1V5E0avDmNyEUuFfYwx3nA05aj-1HY0rA",
        name="Goblin",
        dpi=600,
        size=5_000_000,
    )


class Sources(Enum):
    EXAMPLE_DRIVE_1 = Source(
        pk=0,
        key="example_drive_1",
        name="Example Drive 1",
        identifier="1Fu2nEymZhCpOOZkfF0XoZsVqdIWmPdNq",
        source_type=SourceTypeChoices.GOOGLE_DRIVE,
    )
    EXAMPLE_DRIVE_2 = Source(
        pk=1,
        key="example_drive_2",
        name="Example Drive 2",
        identifier="18wZl7T9DU_lf2X5xYFiyH6pATVy8ZlOd",
        source_type=SourceTypeChoices.GOOGLE_DRIVE,
    )


class Decks(str, Enum):
    # all of these decks have 4x brainstorm, 3x past in flames, and 1x delver of secrets // insectile aberration
    AETHER_HUB = "https://aetherhub.com/Deck/test-796905"
    ARCHIDEKT = "https://archidekt.com/decks/3380653"
    CUBE_COBRA = "https://cubecobra.com/cube/overview/2fj4"
    DECK_STATS = "https://deckstats.net/decks/216625/2754468-test"
    MAGIC_VILLE = "https://magic-ville.com/fr/decks/showdeck?ref=948045"
    MANA_STACK = "https://manastack.com/deck/test-426"
    MOXFIELD = "https://www.moxfield.com/decks/D42-or9pCk-uMi4XzRDziQ"
    MTG_GOLDFISH = "https://www.mtggoldfish.com/deck/5149750"
    SCRYFALL = "https://scryfall.com/@mpcautofill/decks/71bb2d40-c922-4a01-a63e-7ba2dde29a5c"
    TAPPED_OUT = "https://tappedout.net/mtg-decks/09-10-22-DoY-test"
    TCG_PLAYER = "https://decks.tcgplayer.com/magic/standard/mpc-autofill/test/1398367"
