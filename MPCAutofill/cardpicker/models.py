from datetime import datetime
from typing import Any

from django.db import models
from django.utils import dateformat


# Create your models here.
class Source(models.Model):
    key = models.CharField(max_length=50, unique=True)  # must be a valid jquery identifier
    drive_id = models.CharField(max_length=100, unique=True)
    drive_link = models.CharField(max_length=200, blank=True, null=True)
    description = models.CharField(max_length=400)
    order = models.IntegerField(default=0)

    def __str__(self) -> str:
        (qty_total, qty_cards, qty_cardbacks, qty_tokens, _) = self.count()
        return (
            f"[{self.order}.] {self.key} "
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
        ordering = ["order"]

    def to_dict(self) -> dict[str, Any]:
        qty_all, qty_cards, qty_cardbacks, qty_tokens, avgdpi = self.count()
        return {
            "key": self.key,
            "drive_id": self.drive_id,
            "drive_link": self.drive_link,
            "description": self.description,
            "qty_all": qty_all,
            "qty_cards": qty_cards,
            "qty_cardbacks": qty_cardbacks,
            "qty_tokens": qty_tokens,
            "avgdpi": avgdpi,
        }


class CardBase(models.Model):
    drive_id = models.CharField(max_length=50, unique=True)
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
        return "[{}] {}: {}, uploaded: {}".format(self.source, self.name, self.drive_id, self.date)

    def to_dict(self) -> dict[str, Any]:
        return {
            "drive_id": self.drive_id,
            "name": self.name,
            "priority": self.priority,
            "source": self.source.key,
            "source_verbose": self.source_verbose,
            "dpi": self.dpi,
            "searchq": self.searchq,
            "extension": self.extension,
            "date": dateformat.format(self.date, "jS F, Y"),
            "size": self.size,
        }

    def source_to_str(self) -> str:
        return self.source.key

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
