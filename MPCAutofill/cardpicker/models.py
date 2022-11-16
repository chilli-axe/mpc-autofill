from datetime import datetime
from typing import Any, Optional

from django.db import models
from django.utils import dateformat
from django.utils.translation import gettext_lazy

from cardpicker.sources.source_types import SourceTypeChoices


class Faces(models.TextChoices):
    FRONT = ("FRONT", gettext_lazy("Front"))
    BACK = ("BACK", gettext_lazy("Back"))


class CardTypes(models.TextChoices):
    CARD = ("CARD", gettext_lazy("Card"))
    CARDBACK = ("CARDBACK", gettext_lazy("Cardback"))
    TOKEN = ("TOKEN", gettext_lazy("Token"))


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
            f"[{qty_total} total: {qty_cards} cards, {qty_cardbacks} cardbacks, {qty_tokens} tokens]"
        )

    def count(self) -> tuple[str, str, str, str, float]:
        # return the number of cards that this Source created, and the Source's average DPI
        qty_cards = Card.objects.filter(source=self).filter(card_type=CardTypes.CARD).count()
        qty_cardbacks = Card.objects.filter(source=self).filter(card_type=CardTypes.CARDBACK).count()
        qty_tokens = Card.objects.filter(source=self).filter(card_type=CardTypes.TOKEN).count()
        qty_all = qty_cards + qty_cardbacks + qty_tokens

        # if this source has any cards/cardbacks/tokens, average the dpi of all of their things
        avg_dpi = 0
        if qty_all > 0:
            avg_dpi = int(
                (Card.objects.filter(source=self).aggregate(models.Sum("dpi"))["dpi__sum"] if qty_cards > 0 else 0)
                / qty_all
            )
        return (
            f"{qty_all :,d}",
            f"{qty_cards :,d}",
            f"{qty_cardbacks :,d}",
            f"{qty_tokens :,d}",
            avg_dpi,
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


class Card(models.Model):
    card_type = models.CharField(max_length=20, choices=CardTypes.choices, default=CardTypes.CARD)
    identifier = models.CharField(max_length=200, unique=True)
    name = models.CharField(max_length=200)
    priority = models.IntegerField(default=0)
    source = models.ForeignKey(Source, on_delete=models.CASCADE)
    source_verbose = models.CharField(max_length=50)
    folder_location = models.CharField(max_length=300)
    dpi = models.IntegerField(default=0)
    searchq = models.CharField(max_length=200)
    searchq_keyword = models.CharField(max_length=200)
    extension = models.CharField(max_length=200)
    date = models.DateTimeField(default=datetime.now)
    size = models.IntegerField()

    def __str__(self) -> str:
        return (
            f"[{self.source.name}] "
            f"{self.name} "
            f"[Type: {self.card_type}, "
            f"Identifier: {self.identifier}, "
            f"Uploaded: {self.date.strftime('%d/%m/%Y')}, "
            f"Priority: {self.priority}]"
        )

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
            "small_thumbnail_url": self.get_small_thumbnail_url(),
            "medium_thumbnail_url": self.get_medium_thumbnail_url(),
        }

    def get_source_key(self) -> str:
        return self.source.key

    def get_source_name(self) -> str:
        return self.source.name

    def get_source_external_link(self) -> Optional[str]:
        return self.source.external_link or None

    def get_source_type(self) -> str:
        return SourceTypeChoices[self.source.source_type].label

    def get_download_link(self) -> Optional[str]:
        return SourceTypeChoices.get_source_type(SourceTypeChoices[self.source.source_type]).get_download_link(
            self.identifier
        )

    def get_small_thumbnail_url(self) -> Optional[str]:
        return SourceTypeChoices.get_source_type(SourceTypeChoices[self.source.source_type]).get_small_thumbnail_url(
            self.identifier
        )

    def get_medium_thumbnail_url(self) -> Optional[str]:
        return SourceTypeChoices.get_source_type(SourceTypeChoices[self.source.source_type]).get_medium_thumbnail_url(
            self.identifier
        )

    class Meta:
        ordering = ["-priority"]


class DFCPair(models.Model):
    front = models.CharField(max_length=200, unique=True)
    front_searchable = models.CharField(max_length=200, unique=True)
    back = models.CharField(max_length=200, unique=True)
    back_searchable = models.CharField(max_length=200, unique=True)

    def __str__(self) -> str:
        return "{} // {}".format(self.front, self.back)
