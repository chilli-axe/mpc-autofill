import datetime as dt

import pytest

from cardpicker.models import Card
from cardpicker.sources.api import Folder, Image
from cardpicker.sources.update_database import update_database
from cardpicker.tags import Tags


class TestAPI:
    # region constants

    DEFAULT_DATE = dt.datetime(2023, 1, 1)

    FOLDER_A = Folder(id="a", name="Folder A", parent=None)
    FOLDER_B = Folder(id="b", name="Folder B", parent=FOLDER_A)
    FOLDER_C = Folder(id="c", name="Folder C [NSFW]", parent=FOLDER_B)
    FOLDER_D = Folder(id="d", name="Folder D [Tag in data]", parent=FOLDER_B)
    FOLDER_E = Folder(id="e", name="Folder E [tagindata]", parent=FOLDER_B)  # refers to the tag's alias
    FOLDER_F = Folder(id="f", name="Folder F [tagindata]", parent=FOLDER_B)  # refers to the tag's alias
    FOLDER_G = Folder(id="g", name="Folder G [Tag in Data] (Some more words)", parent=FOLDER_B)
    FOLDER_H = Folder(id="h", name="Folder H [Tag in Data, Some more words]", parent=None)
    FOLDER_X = Folder(id="x", name="Folder X [NSFW, Extended, Full Art]", parent=None)
    FOLDER_Y = Folder(id="y", name="Folder Y [full art, Invalid Tag]", parent=None)
    FOLDER_Z = Folder(id="z", name="Folder z [Full Art", parent=None)
    FOLDER_FRENCH = Folder(id="french", name="{FR} Folder", parent=None)

    IMAGE_A = Image(
        id="a",
        name="Image A.png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_B = Image(
        id="b",
        name="Image B [NSFW].png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_C = Image(
        id="b",
        name="Image C.png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_C,
    )
    IMAGE_D = Image(
        id="b",
        name="Image D [NSFW, full art].png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_C,
    )
    IMAGE_E = Image(
        id="e",
        name="Image E [invalid tag.png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_F = Image(
        id="F",
        name="Image F [NSFW, tag in data].png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_G = Image(
        id="G",
        name="Image G [NSFW] (John Doe).png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_H = Image(
        id="H",
        name="Image H [A, NSFW, B] (John Doe).png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_I = Image(
        id="I",
        name="Image A.I.png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_J = Image(
        id="J",
        name="Image J [Child Tag].png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_K = Image(
        id="K",
        name="Image K [Grandchild Tag].png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_L = Image(
        id="L",
        name="Image L [NSFW].png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_D,
    )
    IMAGE_FRENCH = Image(
        id="french",
        name="French.png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_FRENCH,
    )
    IMAGE_ENGLISH = Image(
        id="english",
        name="{EN} English.png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_FRENCH,
    )
    IMAGE_NSFW = Image(
        id="nsfw",
        name="NSFW [NSFW].png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_DOUBLE_NSFW = Image(
        id="double nsfw",
        name="NSFW (NSFW) [NSFW].png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_A,
    )
    IMAGE_IMPLICITLY_FRENCH = Image(
        id="implicitly_french",
        name="Implicitly French.png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_FRENCH,
    )
    IMAGE_EXPLICITLY_ENGLISH = Image(
        id="explicitly_english",
        name="{EN} Explicitly English.png",
        size=1,
        created_time=DEFAULT_DATE,
        modified_time=DEFAULT_DATE,
        height=1,
        folder=FOLDER_FRENCH,
    )

    # endregion

    # region tests

    @pytest.mark.parametrize(
        "folder, full_path",
        [(FOLDER_A, "Folder A"), (FOLDER_B, "Folder A / Folder B"), (FOLDER_C, "Folder A / Folder B / Folder C")],
    )
    def test_folder_full_path(self, django_settings, folder, full_path):
        tags = Tags()
        assert folder.get_full_path(tags=tags) == full_path

    @pytest.mark.parametrize(
        "folder, expected_language",
        [
            (FOLDER_A, None),
            (FOLDER_FRENCH, "FR"),
        ],
    )
    def test_folder_language(self, django_settings, folder, expected_language):
        tags = Tags()
        if expected_language is None:
            assert folder.get_language(tags=tags) is None
        else:
            assert folder.get_language(tags=tags).alpha_2.lower() == expected_language.lower()

    @pytest.mark.parametrize(
        "folder, expected_tags",
        [
            (FOLDER_A, set()),
            (FOLDER_B, set()),
            (FOLDER_C, {"NSFW"}),
            (FOLDER_D, {"Tag in Data"}),
            (FOLDER_E, {"Tag in Data"}),
            (FOLDER_X, {"NSFW", "Extended", "Full Art"}),
            (FOLDER_Y, {"Full Art"}),
            (FOLDER_Z, set()),
        ],
    )
    def test_folder_tags(self, django_settings, tag_in_data, extended_tag, full_art_tag, folder, expected_tags):
        tags = Tags()
        assert folder.get_tags(tags=tags) == expected_tags

    @pytest.mark.parametrize(
        "folder, expected_language, expected_name, expected_tags",
        [
            (FOLDER_A, None, "Folder A", set()),
            (FOLDER_B, None, "Folder B", set()),
            (FOLDER_C, None, "Folder C", {"NSFW"}),
            (FOLDER_G, None, "Folder G (Some more words)", {"Tag in Data"}),
            (FOLDER_H, None, "Folder H [Some more words]", {"Tag in Data"}),
        ],
    )
    def test_folder_name(
        self,
        django_settings,
        tag_in_data,
        extended_tag,
        full_art_tag,
        folder,
        expected_language,
        expected_name,
        expected_tags,
    ):
        tags = Tags()
        language, name, extracted_tags = folder.unpack_name(tags=tags)
        if expected_language is None:
            assert language is None
        else:
            assert language.alpha_2.lower() == expected_language.lower()
        assert name == expected_name
        assert extracted_tags == expected_tags

    @pytest.mark.parametrize(
        "image, expected_language",
        [
            (IMAGE_A, None),
            (IMAGE_FRENCH, "FR"),
            (IMAGE_ENGLISH, "EN"),
            (IMAGE_IMPLICITLY_FRENCH, "FR"),
            (IMAGE_EXPLICITLY_ENGLISH, "EN"),  # despite being in a French folder
        ],
    )
    def test_image_language(self, django_settings, image, expected_language):
        tags = Tags()
        if expected_language is None:
            assert image.get_language(tags=tags) is None
        else:
            assert image.get_language(tags=tags).alpha_2.lower() == expected_language.lower()

    @pytest.mark.parametrize(
        "image, expected_tags",
        [
            (IMAGE_A, set()),
            (IMAGE_B, {"NSFW"}),
            (IMAGE_C, {"NSFW"}),
            (IMAGE_D, {"NSFW", "Full Art"}),
            (IMAGE_E, set()),
            (IMAGE_F, {"NSFW", "Tag in Data"}),
            (IMAGE_H, {"NSFW"}),
            (IMAGE_J, {"Child Tag", "Tag in Data"}),  # `Tag in Data` is implied by `Child Tag`
            (IMAGE_K, {"Grandchild Tag", "Child Tag", "Tag in Data"}),  # `Child Tag` is implied by `Grandchild Tag`
        ],
    )
    def test_image_tags(self, django_settings, grandchild_tag, extended_tag, full_art_tag, image, expected_tags):
        tags = Tags()
        assert image.get_tags(tags=tags) == expected_tags

    @pytest.mark.parametrize(
        "image, expected_language, expected_name, expected_tags, expected_extension",
        [
            (IMAGE_A, None, "Image A", set(), "png"),
            (IMAGE_B, None, "Image B", {"NSFW"}, "png"),
            (IMAGE_C, None, "Image C", {"NSFW"}, "png"),  # tag inherited from parent
            (IMAGE_D, None, "Image D", {"NSFW", "Full Art"}, "png"),
            (IMAGE_E, None, "Image E [invalid tag", set(), "png"),
            (IMAGE_F, None, "Image F", {"NSFW", "Tag in Data"}, "png"),
            (IMAGE_G, None, "Image G (John Doe)", {"NSFW"}, "png"),
            (IMAGE_H, None, "Image H [A, B] (John Doe)", {"NSFW"}, "png"),
            (IMAGE_I, None, "Image A.I", set(), "png"),
            (IMAGE_L, None, "Image L", {"NSFW", "Tag in Data"}, "png"),  # first tag from folder, second from image
            (IMAGE_NSFW, None, "NSFW", {"NSFW"}, "png"),
            (IMAGE_DOUBLE_NSFW, None, "NSFW", {"NSFW"}, "png"),
        ],
    )
    def test_unpack_name(
        self,
        django_settings,
        tag_in_data,
        extended_tag,
        full_art_tag,
        image,
        expected_language,
        expected_name,
        expected_tags,
        expected_extension,
    ):
        tags = Tags()
        language, name, extracted_tags, extension = image.unpack_name(tags=tags)
        if expected_language is None:
            assert language is None
        else:
            assert language.alpha_2.lower() == expected_language.lower()
        assert name == expected_name
        assert extracted_tags == expected_tags
        assert extension == expected_extension


# endregion


class TestUpdateDatabase:
    # region tests

    def test_comprehensive_snapshot(self, snapshot, django_settings, elasticsearch, all_sources, tag_in_data):
        update_database()
        assert list(Card.objects.all().order_by("identifier")) == snapshot(name="cards")

    @pytest.mark.skip("we turned off upsert at time of writing because it's extremely slow with postgres")
    def test_upsert(self, django_settings, elasticsearch, all_sources):
        update_database()
        pk_to_identifier_1 = {x.pk: x.identifier for x in Card.objects.all()}
        update_database()
        pk_to_identifier_2 = {x.pk: x.identifier for x in Card.objects.all()}
        assert pk_to_identifier_1 == pk_to_identifier_2

    # endregion
