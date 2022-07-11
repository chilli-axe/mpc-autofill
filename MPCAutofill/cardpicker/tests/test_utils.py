from cardpicker.utils.to_searchable import to_searchable


def test_to_searchable() -> None:
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
