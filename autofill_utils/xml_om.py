"""
Object Model for interacting with XML file structure
"""


class Element:
    def __iter__(self):
        return iter(self.raw_element)

    def __next__(self):
        return next(self.raw_element)

    def __len__(self):
        return len(self.raw_element)

    def __str__(self):
        return self.raw_element.text or ""

    def __getitem__(self, key):
        return self.raw_element.__getitem__(key)

    def __init__(self, elem):
        self.raw_element = elem
        self.text = elem.text


class Details(Element):
    def __init__(self, elem):
        super().__init__(elem)

        q, b, s, f = map(lambda x: x.text, elem)

        self.quantity = int(q)
        self.bracket = b
        self.stock = s
        self.foil = f == "true"


class Cardback(Element):
    pass


class Card(Element):
    def __init__(self, elem):
        super().__init__(elem)
        try:
            _id, slots, name, _ = map(lambda x: x.text, elem)

            self.id = _id
            self.slots = slots
            self.name = name

        except ValueError as e:
            # Pre 3.0 XML
            return elem


class CardCollection(Element):
    cards = []

    def __iter__(self):
        return iter(self.cards)

    def __getitem__(self, key):
        return self.cards.__getitem__(key)

    def __init__(self, elem):
        super().__init__(elem)
        self.cards = [Card(c) for c in elem]


class XML_Order:
    def __init__(self, root):
        attribs = {
            "details": Details,
            "fronts": CardCollection,
            "backs": CardCollection,
            "cardback": Cardback,
        }
        for child in root:
            # Set an attribute with name == tag and value == Model Class
            setattr(
                self,
                child.tag,
                attribs.get(child.tag, lambda *_: None)(child),  #  Missing tag
            )
