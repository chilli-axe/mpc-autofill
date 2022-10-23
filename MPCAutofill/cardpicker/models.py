import itertools
from datetime import datetime
from typing import Any, Optional

from django.contrib.auth.models import User
from django.db import models, transaction
from django.utils import dateformat, timezone
from django.utils.translation import gettext_lazy

from cardpicker.constants import DATE_FORMAT
from cardpicker.sources.source_types import SourceTypeChoices


class Faces(models.TextChoices):
    FRONT = ("FRONT", gettext_lazy("Front"))
    BACK = ("BACK", gettext_lazy("Back"))


class CardTypes(models.TextChoices):
    CARD = ("CARD", gettext_lazy("Card"))
    CARDBACK = ("CARDBACK", gettext_lazy("Cardback"))
    TOKEN = ("TOKEN", gettext_lazy("Token"))


class Cardstocks(models.TextChoices):
    S30_NONFOIL = ("S30_FOIL", gettext_lazy("S30 (Standard Smooth)"))
    S30_FOIl = ("S30_NONFOIL", gettext_lazy("S30 (Standard Smooth) — Foil"))
    S33_NONFOIL = ("S33_FOIL", gettext_lazy("S33 (Superior Smooth)"))
    S33_FOIl = ("S33_NONFOIL", gettext_lazy("S33 (Superior Smooth) — Foil"))
    M31_NONFOIL = ("M31_FOIL", gettext_lazy("M31 (Linen)"))
    M31_FOIl = ("M31_NONFOIL", gettext_lazy("M31 (Linen) — Foil"))
    P10_NONFOIL = ("P10_NONFOIL", gettext_lazy("P10 (Plastic)"))


class Source(models.Model):
    key = models.CharField(max_length=50, unique=True)  # must be a valid HTML id
    user = models.ForeignKey(to=User, on_delete=models.SET_NULL, null=True, blank=True)
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
            "date": dateformat.format(self.date, DATE_FORMAT),
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


# https://simpleisbetterthancomplex.com/article/2021/07/08/what-you-should-know-about-the-django-user-model.html


def get_default_cardback() -> Optional[Card]:
    return Card.objects.filter(card_type=CardTypes.CARDBACK).order_by("-priority").first()


class Project(models.Model):
    key = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    user = models.ForeignKey(to=User, on_delete=models.CASCADE)
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)
    cardback = models.ForeignKey(to=Card, on_delete=models.SET_NULL, null=True, default=get_default_cardback)
    cardstock = models.CharField(max_length=20, choices=Cardstocks.choices, default=Cardstocks.S30_NONFOIL)

    def get_project_size(self) -> int:
        max_slot: Optional[int] = ProjectMember.objects.filter(project=self).aggregate(models.Max("slot"))["slot__max"]
        if max_slot is None:
            return 0
        return max_slot + 1

    def get_project_members(self) -> dict[str, dict[str, list[dict[str, Any]]]]:  # TODO: horrific typing
        members = list(ProjectMember.objects.filter(project=self))
        # TODO: consider rewriting this to groupby in SQL
        return {
            face: {
                query: [value.to_dict() for value in more_values]
                for query, more_values in itertools.groupby(values, key=lambda x: x.query)
            }
            for face, values in itertools.groupby(
                sorted(members, key=lambda x: (x.face, x.query)), key=lambda x: x.face
            )
        }

    def set_project_members(self, records: dict[str, dict[str, list[dict[str, Any]]]]) -> None:
        """
        Synchronise the members of this project with the contents of `records`.

        :param records: A set of records which follow the schema of `get_project_members`.
        :return: None
        """
        # TODO: protection against bad data here

        card_identifiers = set()
        for face in records.keys():
            for query in records[face].keys():
                for record in records[face][query]:
                    if (card_identifier := record.get("card_identifier"), None) is not None:
                        card_identifiers.add(card_identifier)

        card_identifiers_to_pk: dict[str, Card] = {
            x.identifier: x for x in Card.objects.filter(identifier__in=card_identifiers)
        }

        members: list[ProjectMember] = []
        for face in Faces:
            if (face_members := records.get(face, None)) is not None:
                for query, values in face_members.items():
                    for value in values:
                        card_identifier = value.get("card_identifier", None)
                        members.append(
                            ProjectMember(
                                card=card_identifiers_to_pk[card_identifier] if card_identifier is not None else None,
                                slot=value["slot"],
                                query=query,
                                face=face,
                            )
                        )

        with transaction.atomic():
            ProjectMember.objects.filter(project=self).delete()
            ProjectMember.objects.bulk_create(members)

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "name": self.name,
            "user_username": self.user.username,
            "date_created": dateformat.format(self.date_created, DATE_FORMAT),
            "date_modified": dateformat.format(self.date_modified, DATE_FORMAT),
            "project_size": self.get_project_size(),
        }

    def __str__(self) -> str:
        project_size = self.get_project_size()
        return f"{self.name}: Belongs to {self.user}, has {project_size} card{'s' if project_size != 1 else ''}"


class ProjectMember(models.Model):
    card = models.ForeignKey(to=Card, on_delete=models.SET_NULL, null=True, blank=True)
    project = models.ForeignKey(to=Project, on_delete=models.CASCADE)
    query = models.CharField(max_length=200)
    slot = models.IntegerField()
    face = models.CharField(max_length=5, choices=Faces.choices, default=Faces.FRONT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["card", "project", "slot", "face"], name="projectmember_unique")]

    def to_dict(self) -> dict[str, Any]:
        return {
            "card_identifier": self.card.identifier if self.card else None,
            "query": self.query,
            "slot": self.slot,
            "face": self.face,
        }
