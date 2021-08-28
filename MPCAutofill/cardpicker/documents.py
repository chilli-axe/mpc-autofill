from django.utils import dateformat
from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry

from .models import Card, Cardback, Token


def card_to_dict(obj):
    """
    Serialises a given Card object. Defined here because both models.py and documents.py use this function.
    """
    return {
        "id": obj.id,
        "name": obj.name,
        "priority": obj.priority,
        "source": obj.source,
        "source_verbose": obj.source_verbose,
        "dpi": obj.dpi,
        "searchq": obj.searchq,
        "thumbpath": obj.thumbpath,
        "date": dateformat.format(obj.date, "jS F, Y"),
        "size": obj.size,
    }


common_fields = [
    "id",
    "name",
    "priority",
    "source_verbose",
    "dpi",
    "thumbpath",
    "searchq",
    "date",
    "size",
]

common_settings = {"number_of_shards": 5, "number_of_replicas": 0}


@registry.register_document
class CardSearch(Document):
    source = fields.TextField(attr="source_to_str")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "cards"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Card
        fields = common_fields

    def to_dict(self):
        return card_to_dict(self)


@registry.register_document
class CardbackSearch(Document):
    source = fields.TextField(attr="source_to_str")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "cardbacks"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Cardback
        fields = common_fields

    def to_dict(self):
        return card_to_dict(self)


@registry.register_document
class TokenSearch(Document):
    source = fields.TextField(attr="source_to_str")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "tokens"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Token
        fields = common_fields

    def to_dict(self):
        return card_to_dict(self)
