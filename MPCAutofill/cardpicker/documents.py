from datetime import date, timedelta

from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry
from elasticsearch_dsl import analyzer

from django.db.models import QuerySet, Sum

from cardpicker.models import Card

# custom elasticsearch analysers are configured here to add the `asciifolding` filter, which handles accents:
# https://www.elastic.co/guide/en/elasticsearch/reference/7.17/analysis-asciifolding-tokenfilter.html
# https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-standard-analyzer.html
precise_analyser = analyzer("precise_analyser", tokenizer="keyword", filter=["apostrophe", "lowercase", "asciifolding"])
fuzzy_analyser = analyzer("fuzzy_analyser", tokenizer="standard", filter=["apostrophe", "lowercase", "asciifolding"])


@registry.register_document
class CardSearch(Document):
    source_pk = fields.TextField(attr="get_source_pk", analyzer="keyword")
    searchq_fuzzy = fields.TextField(attr="searchq", analyzer=fuzzy_analyser)
    searchq_precise = fields.TextField(attr="searchq", analyzer=precise_analyser)
    searchq_keyword = fields.KeywordField(attr="searchq")
    card_type = fields.KeywordField()
    date_created = fields.DateField()
    date_modified = fields.DateField()
    language = fields.TextField(analyzer=precise_analyser)  # case insensitivity is one less thing which can go wrong
    tags = fields.KeywordField()  # all elasticsearch fields support arrays by default
    expansion_code = fields.KeywordField(attr="get_expansion_code")
    collector_number = fields.KeywordField(attr="get_collector_number")

    total_downloads = fields.IntegerField()
    downloads_today = fields.IntegerField()
    downloads_this_week = fields.IntegerField()
    downloads_this_month = fields.IntegerField()

    class Index:
        # name of the elasticsearch index
        name = "cards"
        # see Elasticsearch Indices API reference for available settings
        settings = {"number_of_shards": 5, "number_of_replicas": 0}

    class Django:
        model = Card
        fields = ["identifier", "priority", "dpi", "size"]

    def get_queryset(self) -> QuerySet[Card]:
        # https://django-elasticsearch-dsl.readthedocs.io/en/latest/fields.html#handle-relationship-with-nestedfield-objectfield
        return super().get_queryset().select_related("canonical_card", "canonical_card__expansion")

    def prepare_total_downloads(self, instance: Card) -> int:
        return instance.download_counts.aggregate(Sum("count"))["count__sum"] or 0

    def prepare_downloads_today(self, instance: Card) -> int:
        return instance.download_counts.filter(date=date.today()).aggregate(Sum("count"))["count__sum"] or 0

    def prepare_downloads_this_week(self, instance: Card) -> int:
        return (
            instance.download_counts.filter(date__gte=date.today() - timedelta(days=7)).aggregate(Sum("count"))[
                "count__sum"
            ]
            or 0
        )

    def prepare_downloads_this_month(self, instance: Card) -> int:
        return (
            instance.download_counts.filter(date__gte=date.today().replace(day=1)).aggregate(Sum("count"))["count__sum"]
            or 0
        )
