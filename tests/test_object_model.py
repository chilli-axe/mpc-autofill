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

    def test_xml_init(self, xml_order):
        assert(xml_order)
        assert(xml_order.details)
        assert(xml_order.fronts)
        assert(xml_order.cardbacks)
        print(xml_order.details)
        print(xml_order.fronts)
        print(xml_order.cardbacks)

