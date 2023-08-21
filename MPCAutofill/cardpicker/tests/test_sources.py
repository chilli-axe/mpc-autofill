import datetime as dt

import pytest

from cardpicker.models import Card
from cardpicker.sources.api import Folder, Image
from cardpicker.sources.update_database import update_database
from cardpicker.tags import read_tags_in_database


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
    FOLDER_FRENCH = Folder(id="french", name="<FR> Folder", parent=None)

    IMAGE_A = Image(id="a", name="Image A.png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_A)
    IMAGE_B = Image(id="b", name="Image B [NSFW].png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_A)
    IMAGE_C = Image(id="b", name="Image C.png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_C)
    IMAGE_D = Image(
        id="b", name="Image D [NSFW, full art].png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_C
    )
    IMAGE_E = Image(
        id="e", name="Image E [invalid tag.png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_A
    )
    IMAGE_F = Image(
        id="F", name="Image F [NSFW, tag in data].png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_A
    )
    IMAGE_G = Image(
        id="G", name="Image G [NSFW] (John Doe).png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_A
    )
    IMAGE_FRENCH = Image(
        id="french", name="French.png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_FRENCH
    )
    IMAGE_ENGLISH = Image(
        id="english", name="<EN> English.png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_FRENCH
    )
    IMAGE_NSFW = Image(id="nsfw", name="NSFW [NSFW].png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_A)
    IMAGE_DOUBLE_NSFW = Image(
        id="double nsfw", name="NSFW (NSFW) [NSFW].png", size=1, created_time=DEFAULT_DATE, height=1, folder=FOLDER_A
    )

    # endregion

    # region tests

    @pytest.mark.parametrize(
        "folder, full_path",
        [(FOLDER_A, "Folder A"), (FOLDER_B, "Folder A / Folder B"), (FOLDER_C, "Folder A / Folder B / Folder C")],
    )
    def test_folder_full_path(self, folder, full_path):
        assert folder.full_path == full_path

    @pytest.mark.parametrize(
        "folder, expected_language",
        [
            (FOLDER_A, None),
            (FOLDER_FRENCH, "FR"),
        ],
    )
    def test_folder_language(self, folder, expected_language):
        if expected_language is None:
            assert folder.language is None
        else:
            assert folder.language.alpha_2.lower() == expected_language.lower()

    @pytest.mark.parametrize(
        "folder, expected_tags",
        [
            (FOLDER_A, set()),
            (FOLDER_B, set()),
            (FOLDER_C, {"NSFW"}),
            (FOLDER_D, {"Tag In Data"}),
            (FOLDER_E, {"Tag In Data"}),
            (FOLDER_X, {"NSFW", "Extended", "Full Art"}),
            (FOLDER_Y, {"Full Art"}),
            (FOLDER_Z, set()),
        ],
    )
    def test_folder_tags(self, django_settings, tags, folder, expected_tags):
        read_tags_in_database()
        assert folder.tags == expected_tags

    @pytest.mark.parametrize(
        "folder, expected_name",
        [
            (FOLDER_A, "Folder A"),
            (FOLDER_B, "Folder B"),
            (FOLDER_C, "Folder C"),
            (FOLDER_G, "Folder G (Some more words)"),
            (FOLDER_H, "Folder H [Some more words]"),
        ],
    )
    def test_folder_name(self, django_settings, tags, folder, expected_name):
        read_tags_in_database()
        _, name, _ = folder.unpacked_name
        assert name == expected_name

    @pytest.mark.parametrize(
        "image, expected_language",
        [
            (IMAGE_A, None),
            (IMAGE_FRENCH, "FR"),
            (IMAGE_ENGLISH, "EN"),
        ],
    )
    def test_image_language(self, image, expected_language):
        if expected_language is None:
            assert image.language is None
        else:
            assert image.language.alpha_2.lower() == expected_language.lower()

    @pytest.mark.parametrize(
        "image, expected_tags",
        [
            (IMAGE_A, set()),
            (IMAGE_B, {"NSFW"}),
            (IMAGE_C, {"NSFW"}),
            (IMAGE_D, {"NSFW", "Full Art"}),
            (IMAGE_E, set()),
            (IMAGE_F, {"NSFW", "Tag In Data"}),
        ],
    )
    def test_image_tags(self, django_settings, tags, image, expected_tags):
        read_tags_in_database()
        assert image.tags == expected_tags

    @pytest.mark.parametrize(
        "image, expected_name",
        [
            (IMAGE_A, "Image A"),
            (IMAGE_B, "Image B"),
            (IMAGE_C, "Image C"),
            (IMAGE_D, "Image D"),
            (IMAGE_E, "Image E [invalid tag"),
            (IMAGE_F, "Image F"),
            (IMAGE_G, "Image G (John Doe)"),
            (IMAGE_NSFW, "NSFW"),
            (IMAGE_DOUBLE_NSFW, "NSFW"),
        ],
    )
    def test_image_name(self, django_settings, tags, image, expected_name):
        read_tags_in_database()
        _, name, _, _ = image.unpacked_name
        assert name == expected_name


# endregion


class TestUpdateDatabase:
    # region tests

    def test_comprehensive_snapshot(self, snapshot, django_settings, elasticsearch, all_sources, tags):
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
