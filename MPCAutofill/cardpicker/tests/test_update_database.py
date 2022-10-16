from cardpicker.models import Card, Cardback, Token
from cardpicker.sources.update_database import update_database


class TestUpdateDatabase:
    # region tests

    def test_comprehensive_snapshot(self, snapshot, django_settings, stand_up_database):
        update_database()
        assert list(Card.objects.all().order_by("identifier")) == snapshot(name="cards")
        assert list(Cardback.objects.all().order_by("identifier")) == snapshot(name="cardbacks")
        assert list(Token.objects.all().order_by("identifier")) == snapshot(name="tokens")

    def test_upsert(self, django_settings, stand_up_database):
        update_database()
        pk_to_identifier_1 = (
            {x.pk: x.identifier for x in Card.objects.all()}
            | {x.pk: x.identifier for x in Cardback.objects.all()}
            | {x.pk: x.identifier for x in Token.objects.all()}
        )
        update_database()
        pk_to_identifier_2 = (
            {x.pk: x.identifier for x in Card.objects.all()}
            | {x.pk: x.identifier for x in Cardback.objects.all()}
            | {x.pk: x.identifier for x in Token.objects.all()}
        )
        assert pk_to_identifier_1 == pk_to_identifier_2

    # endregion
