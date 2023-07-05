import factory

from cardpicker import models
from cardpicker.utils.sanitisation import to_searchable


class DFCPairFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.DFCPair

    front = factory.Sequence(lambda n: f"Front {n}")
    front_searchable = factory.Sequence(lambda n: f"front {n}")
    back = factory.Sequence(lambda n: f"Back {n}")
    back_searchable = factory.Sequence(lambda n: f"back {n}")


class SourceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Source

    key = factory.Sequence(lambda n: f"source_{n}")
    name = factory.Sequence(lambda n: f"Source {n}")
    source_type = models.SourceTypeChoices.GOOGLE_DRIVE
    description = factory.LazyAttribute(lambda o: f"Description for {o.key}")
    ordinal = factory.Sequence(lambda n: n)


class CardFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Card

    card_type = models.CardTypes.CARD
    identifier = factory.Sequence(lambda n: f"card_{n}")
    name = factory.Sequence(lambda n: f"Card {n}")
    priority = factory.Sequence(lambda n: n)
    source = factory.SubFactory(SourceFactory)
    source_verbose = factory.LazyAttribute(lambda o: f"{o.source.name} but verbose")
    folder_location = factory.LazyFunction(lambda: "path")
    dpi = factory.LazyFunction(lambda: 800)
    searchq = factory.LazyAttribute(lambda o: to_searchable(o.name))
    searchq_keyword = factory.LazyAttribute(lambda o: to_searchable(o.name))
    extension = factory.LazyFunction(lambda: "png")
    size = factory.LazyFunction(lambda: 100)
