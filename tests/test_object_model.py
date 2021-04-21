import pytest

import xml.etree.ElementTree as ET

from autofill_utils import currdir, XML_Order


TEST_XML = "sample.xml"

@pytest.fixture
def root():
    yield ET.parse(f"{currdir()}/tests/{TEST_XML}").getroot()

@pytest.fixture
def xml_order(root):
    yield XML_Order(root)


class TestOM:
    def test_root_exists(self, root):
        assert(root is not None)

    def test_details(self, xml_order):
        for k, t in (
            ('quantity', int),
            ('bracket', str),
            ('stock', str),
            ('foil', bool)):
            # Check the type of the details object
            assert(isinstance(getattr(xml_order.details, k), t))

    def test_fronts(self, xml_order):
        assert(xml_order.fronts is not None)
        assert(len(xml_order.fronts)) > 0

        assert(xml_order.fronts[0])
        assert(xml_order.fronts[0].id)
        assert(xml_order.fronts[0].slots)
        assert(xml_order.fronts[0].name)

    def test_backs(self, xml_order):
        assert(xml_order.backs is not None)
        assert(len(xml_order.backs) == 1)

    def test_cardback(self, xml_order):
        assert(xml_order.cardback.text)
