import pytest

from cardpicker.dfc_pairs import sync_dfcs
from cardpicker.models import DFCPair


class TestSyncDFCs:
    # region fixtures

    @pytest.fixture(autouse=True)
    def autouse_dummy_integration(self, dummy_integration):
        pass

    # endregion

    # region tests

    def test_comprehensive_snapshot(self, snapshot, django_settings):
        sync_dfcs()
        assert list(DFCPair.objects.all().order_by("front")) == snapshot()

    def test_upsert(self, django_settings):
        sync_dfcs()
        pk_to_identifier_1 = {x.pk: (x.front, x.back) for x in DFCPair.objects.all()}
        sync_dfcs()
        pk_to_identifier_2 = {x.pk: (x.front, x.back) for x in DFCPair.objects.all()}
        assert pk_to_identifier_1 == pk_to_identifier_2

    # endregion
