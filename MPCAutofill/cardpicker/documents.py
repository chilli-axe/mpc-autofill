from django.utils import dateformat
from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry
from hurry.filesize import alternative, size

from .models import Card, Cardback, Token

datestring = "jS F, Y"

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
        return {
            "id": self.id,
            "name": self.name,
            "priority": self.priority,
            "source": self.source,
            "source_verbose": self.source_verbose,
            "dpi": self.dpi,
            "searchq": self.searchq,
            "thumbpath": self.thumbpath,
            "date": dateformat.format(self.date, datestring),
            "size": size(self.size, system=alternative),
        }


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
        return {
            "id": self.id,
            "name": self.name,
            "priority": self.priority,
            "source": self.source,
            "source_verbose": self.source_verbose,
            "dpi": self.dpi,
            "searchq": self.searchq,
            "thumbpath": self.thumbpath,
            "date": dateformat.format(self.date, datestring),
            "size": size(self.size, system=alternative),
        }


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
        return {
            "id": self.id,
            "name": self.name,
            "priority": self.priority,
            "source": self.source,
            "source_verbose": self.source_verbose,
            "dpi": self.dpi,
            "searchq": self.searchq,
            "thumbpath": self.thumbpath,
            "date": dateformat.format(self.date, datestring),
            "size": size(self.size, system=alternative),
        }
