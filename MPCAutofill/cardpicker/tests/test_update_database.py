from cardpicker.models import Card
from cardpicker.sources.update_database import update_database


class TestUpdateDatabase:
    # region tests

    def test_comprehensive_snapshot(self, snapshot, django_settings, elasticsearch, all_sources):
        update_database()
        assert list(Card.objects.all().order_by("identifier")) == snapshot(name="cards")

    def test_upsert(self, django_settings, elasticsearch, all_sources):
        update_database()
        pk_to_identifier_1 = {x.pk: x.identifier for x in Card.objects.all()}
        update_database()
        pk_to_identifier_2 = {x.pk: x.identifier for x in Card.objects.all()}
        assert pk_to_identifier_1 == pk_to_identifier_2

    # endregion
