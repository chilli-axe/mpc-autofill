from django.utils import dateformat
from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry

from .models import Card, Cardback, Token


def card_to_dict(obj):
    """
    Serialises a given Card object.
    """
    return {
        "id": obj.id,
        "drive_id": obj.drive_id,
        "extension": obj.extension,
        "file_path": obj.file_path,
        "name": obj.name,
        "priority": obj.priority,
        "source": obj.source,
        "source_type": obj.source_type,
        "source_verbose": obj.source_verbose,
        "searchq": obj.searchq,
        "dpi": obj.dpi,
        "date": dateformat.format(obj.date, "jS F, Y"),
        "size": obj.size,
    }


common_fields = [
    "id",
    "drive_id",
    "extension",
    "file_path",
    "name",
    "priority",
    "source_verbose",
    "searchq",
    "dpi",
    "date",
    "size",
]

common_settings = {"number_of_shards": 5, "number_of_replicas": 0}


@registry.register_document
class CardSearch(Document):
    source = fields.TextField(attr="source_to_str")
    source_type = fields.TextField(attr="source_type_to_str")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "cards"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Card
        fields = common_fields

    def to_dict(self, include_meta=False, skip_empty=True):
        return card_to_dict(self)


@registry.register_document
class CardbackSearch(Document):
    source = fields.TextField(attr="source_to_str")
    source_type = fields.TextField(attr="source_type_to_str")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "cardbacks"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Cardback
        fields = common_fields

    def to_dict(self, include_meta=False, skip_empty=True):
        return card_to_dict(self)


@registry.register_document
class TokenSearch(Document):
    source = fields.TextField(attr="source_to_str")
    source_type = fields.TextField(attr="source_type_to_str")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "tokens"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Token
        fields = common_fields

    def to_dict(self, include_meta=False, skip_empty=True):
        return card_to_dict(self)
