from typing import Any, Union

from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry

from django.utils import dateformat

from .models import Card, Cardback, Token

common_fields = ["identifier", "name", "priority", "source_verbose", "dpi", "extension", "searchq", "date", "size"]

common_settings = {"number_of_shards": 5, "number_of_replicas": 0}


@registry.register_document
class CardSearch(Document):
    source = fields.TextField(attr="get_source_key")
    source_name = fields.TextField(attr="get_source_name")
    source_external_link = fields.TextField(attr="get_source_external_link")
    source_type = fields.TextField(attr="get_source_type")
    download_link = fields.TextField(attr="get_download_link")
    small_thumbnail_url = fields.TextField(attr="get_small_thumbnail_url")
    medium_thumbnail_url = fields.TextField(attr="get_medium_thumbnail_url")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "cards"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Card
        fields = common_fields

    def to_dict(self, **kwargs: dict[str, Any]) -> dict[str, Any]:
        return card_to_dict(self)


@registry.register_document
class CardbackSearch(Document):
    source = fields.TextField(attr="get_source_key")
    source_name = fields.TextField(attr="get_source_name")
    source_external_link = fields.TextField(attr="get_source_external_link")
    source_type = fields.TextField(attr="get_source_type")
    download_link = fields.TextField(attr="get_download_link")
    small_thumbnail_url = fields.TextField(attr="get_small_thumbnail_url")
    medium_thumbnail_url = fields.TextField(attr="get_medium_thumbnail_url")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "cardbacks"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Cardback
        fields = common_fields

    def to_dict(self, **kwargs: dict[str, Any]) -> dict[str, Any]:
        return card_to_dict(self)


@registry.register_document
class TokenSearch(Document):
    source = fields.TextField(attr="get_source_key")
    source_name = fields.TextField(attr="get_source_name")
    source_external_link = fields.TextField(attr="get_source_external_link")
    source_type = fields.TextField(attr="get_source_type")
    download_link = fields.TextField(attr="get_download_link")
    small_thumbnail_url = fields.TextField(attr="get_small_thumbnail_url")
    medium_thumbnail_url = fields.TextField(attr="get_medium_thumbnail_url")
    searchq_keyword = fields.TextField(analyzer="keyword")

    class Index:
        # name of the elasticsearch index
        name = "tokens"
        # see Elasticsearch Indices API reference for available settings
        settings = common_settings

    class Django:
        model = Token
        fields = common_fields

    def to_dict(self, **kwargs: dict[str, Any]) -> dict[str, Any]:
        return card_to_dict(self)


def card_to_dict(obj: Union[CardSearch, CardbackSearch, TokenSearch]) -> dict[str, Any]:
    """
    Serialises a given Card document.
    """

    return {
        "identifier": obj.identifier,
        "name": obj.name,
        "priority": obj.priority,
        "source": obj.source,
        "source_name": obj.source_name,
        "source_external_link": obj.source_external_link,
        "source_verbose": obj.source_verbose,
        "source_type": obj.source_type,
        "dpi": obj.dpi,
        "searchq": obj.searchq,
        "extension": obj.extension,
        "date": dateformat.format(obj.date, "jS F, Y"),
        "size": obj.size,
        "download_link": obj.download_link,
        "small_thumbnail_url": obj.small_thumbnail_url,
        "medium_thumbnail_url": obj.medium_thumbnail_url,
    }
