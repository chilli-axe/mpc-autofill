from cardpicker.utils import process_line, to_searchable


class TestUtils:
    # region tests
    def test_to_searchable(self) -> None:
        # basic case
        assert to_searchable("Lightning Bolt") == "lightning bolt"
        assert to_searchable(" Lightning   BOLT ") == "lightning bolt"
        # punctuation
        assert to_searchable("Adanto, the First Fort") == "adanto first fort"
        # brackets removal
        assert to_searchable("Black Lotus (Masterpiece)") == "black lotus"
        assert to_searchable("Black Lotus (Masterpiece, But With Punctuation! )") == "black lotus"
        # accents
        assert to_searchable("Juzám Djinn") == "juzam djinn"
        # punctuation with double spaces
        assert to_searchable(" Expansion _ Explosion") == "expansion explosion"

    def test_process_line(self):
        # basic cases
        assert process_line("1 brainstorm") == ("brainstorm", 1)
        assert process_line("brainstorm") == ("brainstorm", 1)
        assert process_line("2x brainstorm") == ("brainstorm", 2)
        # trim whitespace
        assert process_line("   3      brainstorm  ") == ("brainstorm", 3)
        # empty cases
        assert process_line("1") == (None, None)
        assert process_line("") == (None, None)

    # endregion
