"""
Object Model for interacting with XML file structure
"""

class Element:
    def __init__(self, elem):
        self.raw_element = elem

class Details(Element):
    pass
class Fronts(Element):
    pass
class Cardbacks(Element):
    pass


class XML_Order:
    def __init__(self, root):
        de, fe, ce = root
        self.details = Details(de)
        self.fronts = Fronts(fe)
        self.cardbacks = Cardbacks(ce)

