from haystack import indexes
from .models import Card


class CardIndex(indexes.SearchIndex, indexes.Indexable):
    text = indexes.CharField(document=True, use_template=True)

    def get_model(self):
        return Card

    def index_queryset(self, using=None):
        return self.get_model().objects.all()
