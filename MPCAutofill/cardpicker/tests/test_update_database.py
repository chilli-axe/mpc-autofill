from cardpicker.models import Card, Cardback, Token
from cardpicker.sources.update_database import update_database


class TestUpdateDatabase:
    # region tests

    def test_comprehensive_snapshot(self, snapshot, django_settings, stand_up_database):
        update_database()
        assert list(Card.objects.all().order_by("identifier")) == snapshot(name="cards")
        assert list(Cardback.objects.all().order_by("identifier")) == snapshot(name="cardbacks")
        assert list(Token.objects.all().order_by("identifier")) == snapshot(name="tokens")

    # endregion
