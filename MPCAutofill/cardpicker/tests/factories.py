import factory

from cardpicker import models


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
