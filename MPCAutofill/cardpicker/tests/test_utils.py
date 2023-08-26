import pytest

from cardpicker.search.sanitisation import process_line, to_searchable


class TestUtils:
    # region tests

    @pytest.mark.parametrize(
        "input_string, output",
        [
            ("Lightning Bolt", "lightning bolt"),
            (" Lightning   BOLT ", "lightning bolt"),
            ("Adanto, the First Fort", "adanto first fort"),
            # brackets removal
            ("Black Lotus (Masterpiece)", "black lotus"),
            ("Black Lotus (Masterpiece, But With Punctuation! )", "black lotus"),
            ("Juzám Djinn", "juzám djinn"),  # elasticsearch will handle this
            (" Expansion _ Explosion", "expansion explosion"),
            ("Kodama’s Reach", "kodamas reach"),
            ("消灭邪物", "消灭邪物"),
        ],
        ids=[
            "basic case 1",
            "basic case 2",
            "punctuation",
            "brackets removal 1",
            "brackets removal 2",
            "accents",
            "punctuation with double spaces",
            "right apostrophes are handled correctly",
            "foreign language characters",
        ],
    )
    def test_to_searchable(self, input_string, output) -> None:
        assert to_searchable(input_string) == output

    @pytest.mark.parametrize(
        "input_string, output",
        [
            ("1 brainstorm", ("brainstorm", 1)),
            ("brainstorm", ("brainstorm", 1)),
            ("2x brainstorm", ("brainstorm", 2)),
            ("   3      brainstorm  ", ("brainstorm", 3)),
            ("1", (None, None)),
            ("", (None, None)),
        ],
        ids=["basic case 1", "basic case 2", "basic case 3", "trim whitespace", "empty case 1", "empty case 2"],
    )
    def test_process_line(self, input_string, output):
        assert process_line(input_string) == output

    # endregion
