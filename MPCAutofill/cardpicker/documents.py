from django_elasticsearch_dsl import Document
from django_elasticsearch_dsl.registries import registry

from .models import Card, Cardback, Token

common_fields = [
    'id',
    'name',
    'priority',
    'source',
    'dpi',
    'thumbpath',
    'searchq',
    'date',
]

common_settings = {
    'number_of_shards': 5,
    'number_of_replicas': 0
}


@registry.register_document
class CardSearch(Document):
    class Index:
        # name of the elasticsearch index
        name = 'cards'
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Card
        fields = common_fields


@registry.register_document
class CardbackSearch(Document):
    class Index:
        # name of the elasticsearch index
        name = 'cardbacks'
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Cardback
        fields = common_fields


@registry.register_document
class TokenSearch(Document):
    class Index:
        # name of the elasticsearch index
        name = 'tokens'
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Token
        fields = common_fields
