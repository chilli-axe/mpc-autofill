from datetime import datetime
from typing import Any, Optional

from cardpicker.sources.source_types import SourceTypeChoices
from django.db import models
from django.utils import dateformat


class Source(models.Model):
    key = models.CharField(max_length=50, unique=True)  # must be a valid HTML id
    name = models.CharField(max_length=50, unique=True)  # human-readable name
    identifier = models.CharField(max_length=200, unique=True)  # e.g. drive ID, root directory path
    source_type = models.CharField(
        max_length=20, choices=SourceTypeChoices.choices, default=SourceTypeChoices.GOOGLE_DRIVE
    )
    external_link = models.CharField(max_length=200, blank=True, null=True)
    description = models.CharField(max_length=400)
    ordinal = models.IntegerField(default=0)

    def __str__(self) -> str:
        (qty_total, qty_cards, qty_cardbacks, qty_tokens, _) = self.count()
        return (
            f"[{self.ordinal}.] {self.name} "
            f"({qty_total} total: {qty_cards} cards, {qty_cardbacks} cardbacks, {qty_tokens} tokens)"
        )

    def count(self) -> tuple[str, str, str, str, float]:
        # return the number of cards that this Source created, and the Source's average DPI
        qty_cards = Card.objects.filter(source=self).count()
        qty_cardbacks = Cardback.objects.filter(source=self).count()
        qty_tokens = Token.objects.filter(source=self).count()
        qty_all = qty_cards + qty_cardbacks + qty_tokens

        # if this source has any cards/cardbacks/tokens, average the dpi of all of their things
        if qty_all > 0:
            total_dpi = 0
            total_dpi += (
                Card.objects.filter(source=self).aggregate(models.Sum("dpi"))["dpi__sum"] if qty_cards > 0 else 0
            )
            total_dpi += (
                Cardback.objects.filter(source=self).aggregate(models.Sum("dpi"))["dpi__sum"]
                if qty_cardbacks > 0
                else 0
            )
            total_dpi += (
                Token.objects.filter(source=self).aggregate(models.Sum("dpi"))["dpi__sum"] if qty_tokens > 0 else 0
            )
            avgdpi = int(total_dpi / qty_all)
        else:
            avgdpi = 0

        return (
            f"{qty_all :,d}",
            f"{qty_cards :,d}",
            f"{qty_cardbacks :,d}",
            f"{qty_tokens :,d}",
            avgdpi,
        )

    class Meta:
        ordering = ["ordinal"]

    def to_dict(self, count: bool = False) -> dict[str, Any]:
        source_dict = {
            "key": self.key,
            "name": self.name,
            "identifier": self.identifier,
            "source_type": SourceTypeChoices[self.source_type].label,
            "external_link": self.external_link,
            "description": self.description,
        }
        if not count:
            return source_dict
        qty_all, qty_cards, qty_cardbacks, qty_tokens, avgdpi = self.count()
        return source_dict | {
            "qty_all": qty_all,
            "qty_cards": qty_cards,
            "qty_cardbacks": qty_cardbacks,
            "qty_tokens": qty_tokens,
            "avgdpi": avgdpi,
        }


class CardBase(models.Model):
    identifier = models.CharField(max_length=200, unique=True)
    name = models.CharField(max_length=200)
    priority = models.IntegerField(default=0)
    source = models.ForeignKey(Source, on_delete=models.CASCADE)
    source_verbose = models.CharField(max_length=50)
    dpi = models.IntegerField(default=0)
    searchq = models.CharField(max_length=200)
    searchq_keyword = models.CharField(max_length=200)
    extension = models.CharField(max_length=200)
    date = models.DateTimeField(default=datetime.now)
    size = models.IntegerField()

    def __str__(self) -> str:
        return "[{}] {}: {}, uploaded: {}".format(self.source, self.name, self.identifier, self.date)

    def to_dict(self) -> dict[str, Any]:
        return {
            "identifier": self.identifier,
            "name": self.name,
            "priority": self.priority,
            "source": self.source.key,
            "source_verbose": self.source_verbose,
            "source_type": self.get_source_type(),
            "dpi": self.dpi,
            "searchq": self.searchq,
            "extension": self.extension,
            "date": dateformat.format(self.date, "jS F, Y"),
            "size": self.size,
            "download_link": self.get_download_link(),
        }

    def get_source_key(self) -> str:
        return self.source.key

    def get_source_name(self) -> str:
        return self.source.name

    def get_source_type(self) -> str:
        return SourceTypeChoices[self.source.source_type].label

    def get_download_link(self) -> Optional[str]:
        return SourceTypeChoices.get_source_type(SourceTypeChoices[self.source.source_type]).get_download_link(
            self.identifier
        )

    class Meta:
        abstract = True
        ordering = ["-priority"]


class Card(CardBase):
    pass


class Cardback(CardBase):
    pass


class Token(CardBase):
    pass


class DFCPair(models.Model):
    front = models.CharField(max_length=200, unique=True)
    front_searchable = models.CharField(max_length=200, unique=True)
    back = models.CharField(max_length=200, unique=True)
    back_searchable = models.CharField(max_length=200, unique=True)

    def __str__(self) -> str:
        return "{} // {}".format(self.front, self.back)
