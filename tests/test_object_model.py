import pytest

import xml.etree.ElementTree as ET

from mpc_utils import currdir, XML_Order


TEST_XML = "cards.xml"

@pytest.fixture
def root():
    yield ET.parse(f"{currdir()}/{TEST_XML}").getroot()

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
        assert(xml_order.fronts)

    def test_cardbacks(self, xml_order):
        assert(xml_order.cardbacks)
