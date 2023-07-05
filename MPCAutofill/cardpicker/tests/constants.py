from dataclasses import dataclass
from enum import Enum

from cardpicker.sources.source_types import SourceTypeChoices


@dataclass
class Card:
    identifier: str
    name: str


@dataclass
class Source:
    key: str
    name: str
    identifier: str
    source_type: SourceTypeChoices


class Cards(Enum):
    BRAINSTORM = Card(identifier="1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5", name="Brainstorm")
    ISLAND = Card(identifier="1IDtqSjJ4Yo45AnNA4SplOiN7ewibifMa", name="Island")
    ISLAND_CLASSICAL = Card(identifier="1HsvTYs1jFGe1c8U1PnNZ9aB8jkAW7KU0", name="Island (William Bradford)")
    MOUNTAIN = Card(identifier="1-dcs0FEE05MTGiYbKqs9HnRdhXkgtIJG", name="Mountain")
    SIMPLE_CUBE = Card(identifier="1JtXL6Ca9nQkvhwZZRR9ZuKA9_DzsFf1V", name="Simple Cube")  # default back
    SIMPLE_LOTUS = Card(identifier="1oigI6wz0zA--pNMuExKTs40kBNH6VRP_", name="Simple Lotus")
    HUNTMASTER_OF_THE_FELLS = Card(identifier="1991MWCur9NdAFi-tQQD5YbQj2oqV_WRy", name="Huntmaster of the Fells")
    RAVAGER_OF_THE_FELLS = Card(identifier="1lv8WC1Xf1qxA7VHSc8jOtT5up6FwaBPH", name="Ravager of the Fells")
    PAST_IN_FLAMES_1 = Card(identifier="1UPdh7J7hScg4ZnxSPJ-EeBYHLp2s3Oz1", name="Past in Flames")
    PAST_IN_FLAMES_2 = Card(identifier="1dxSLHtw-VwwE09pZCA8OA6LbuWRZPEoU", name="Past in Flames")
    DELVER_OF_SECRETS = Card(identifier="17fopRCNRge72U8Hac8pApHZtEalx5kHy", name="Delver of Secrets")
    INSECTILE_ABERRATION = Card(identifier="1mO73GTYlieP0kiZEkF58pJSrZTmC9lNh", name="Insectile Aberration")
    GOBLIN = Card(identifier="1V5E0avDmNyEUuFfYwx3nA05aj-1HY0rA", name="Goblin")  # token


class Sources(Enum):
    EXAMPLE_DRIVE_1 = Source(
        key="example_drive_1",
        name="Example Drive 1",
        identifier="1Fu2nEymZhCpOOZkfF0XoZsVqdIWmPdNq",
        source_type=SourceTypeChoices.GOOGLE_DRIVE,
    )
    EXAMPLE_DRIVE_2 = Source(
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
