import itertools
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any, Optional

from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.db import connection, models, transaction
from django.utils import dateformat, timezone
from django.utils.translation import gettext_lazy

from cardpicker.constants import DATE_FORMAT
from cardpicker.schema_types import Card as SerialisedCard
from cardpicker.schema_types import CardType, ChildElement
from cardpicker.schema_types import Source as SerialisedSource
from cardpicker.schema_types import SourceContribution, SourceType
from cardpicker.schema_types import Tag as SerialisedTag
from cardpicker.sources.source_types import SourceTypeChoices


class Faces(models.TextChoices):
    FRONT = ("FRONT", gettext_lazy("Front"))
    BACK = ("BACK", gettext_lazy("Back"))


class CardTypes(models.TextChoices):
    CARD = (CardType.CARD.name, gettext_lazy(CardType.CARD.value.title()))
    CARDBACK = (CardType.CARDBACK.name, gettext_lazy(CardType.CARDBACK.value.title()))
    TOKEN = (CardType.TOKEN.name, gettext_lazy(CardType.TOKEN.value.title()))


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
    description = models.CharField(max_length=400, blank=True)
    ordinal = models.IntegerField(default=0)  # TODO: why is this not unique?

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

    def serialise(self) -> SerialisedSource:
        # note: `identifier` should not be exposed here.
        return SerialisedSource(
            pk=self.pk,
            key=self.key,
            name=self.name,
            sourceType=SourceType(SourceTypeChoices[self.source_type].label),
            externalLink=self.external_link,
            description=self.description,
        )

    def to_dict(self) -> dict[str, Any]:
        return self.serialise().model_dump()


def summarise_contributions() -> tuple[list[SourceContribution], dict[str, int], int]:
    """
    Report on the number of cards, cardbacks, and tokens that each Source has, as well as the average DPI across all
    three card types.
    Rawdogging the SQL here to minimise the number of hits to the database. I might come back to this at some point
    to rewrite in Django ORM at a later point.
    """

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                cardpicker_source.name,
                cardpicker_source.identifier,
                cardpicker_source.source_type,
                cardpicker_source.external_link,
                cardpicker_source.description,
                cardpicker_source.ordinal,
                COALESCE(SUM(cardpicker_card.dpi), 0),
                COUNT(cardpicker_card.dpi),
                COALESCE(SUM(cardpicker_card.size), 0)
            FROM cardpicker_source
            LEFT JOIN cardpicker_card ON cardpicker_source.id = cardpicker_card.source_id
            GROUP BY cardpicker_source.name,
                cardpicker_source.identifier,
                cardpicker_source.source_type,
                cardpicker_source.external_link,
                cardpicker_source.description,
                cardpicker_source.ordinal
            ORDER BY cardpicker_source.ordinal, cardpicker_source.name
            """
        )
        results_1 = cursor.fetchall()
        cursor.execute(
            """
            SELECT
                cardpicker_source.identifier,
                cardpicker_card.card_type,
                COUNT(cardpicker_card.card_type)
            FROM cardpicker_source
            LEFT JOIN cardpicker_card ON cardpicker_source.id = cardpicker_card.source_id
            GROUP BY cardpicker_source.identifier, cardpicker_card.card_type
            """
        )
        results_2 = cursor.fetchall()

    source_card_count_by_type: dict[str, dict[str, int]] = defaultdict(dict)
    card_count_by_type: dict[str, int] = {card_type: 0 for card_type in CardTypes}
    for identifier, card_type, count in results_2:
        if card_type is not None:
            source_card_count_by_type[identifier][card_type] = count
            card_count_by_type[card_type] += count
    sources = []
    total_database_size = 0
    for (
        name,
        identifier,
        source_type,
        external_link,
        description,
        ordinal,
        total_dpi,
        total_count,
        total_size,
    ) in results_1:
        # note: `identifier` should not be exposed here.
        sources.append(
            SourceContribution(
                name=name,
                sourceType=SourceType(SourceTypeChoices[source_type].label),
                externalLink=external_link,
                description=description,
                qtyCards=f"{source_card_count_by_type[identifier].get(CardTypes.CARD, 0):,d}",
                qtyCardbacks=f"{source_card_count_by_type[identifier].get(CardTypes.CARDBACK, 0) :,d}",
                qtyTokens=f"{source_card_count_by_type[identifier].get(CardTypes.TOKEN, 0) :,d}",
                avgdpi=f"{(total_dpi / total_count):.2f}" if total_count > 0 else "0",
                size=f"{(total_size / 1_000_000_000):.2f} GB",
            )
        )
        total_database_size += total_size
    return sources, card_count_by_type, total_database_size


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
    extension = models.CharField(max_length=200)
    date = models.DateTimeField(default=datetime.now)
    size = models.IntegerField()
    tags = ArrayField(models.CharField(max_length=20), default=list, blank=True)  # null=True is just for admin panel
    language = models.CharField(max_length=5)

    def __str__(self) -> str:
        return (
            f"[{self.source.name}] "
            f"<{self.language}> "
            f"{self.name} "
            f"[Type: {self.card_type}, "
            f"Identifier: {self.identifier}, "
            f"Uploaded: {self.date.strftime('%d/%m/%Y')}, "
            f"Priority: {self.priority}]"
        )

    def serialise(self) -> SerialisedCard:
        return SerialisedCard(
            identifier=self.identifier,
            cardType=CardType(self.card_type),
            name=self.name,
            priority=self.priority,
            # TODO: consider only including source_pk here. reference the other data from sourceDocuments in frontend
            source=self.source.key,
            sourceName=self.source.name,
            sourceId=self.source.pk,
            sourceVerbose=self.source_verbose,
            sourceType=self.get_source_type(),
            sourceExternalLink=self.get_source_external_link(),
            dpi=self.dpi,
            searchq=self.searchq,
            extension=self.extension,
            date=dateformat.format(self.date, DATE_FORMAT),
            size=self.size,
            downloadLink=self.get_download_link() or "",
            smallThumbnailUrl=self.get_small_thumbnail_url() or "",
            mediumThumbnailUrl=self.get_medium_thumbnail_url() or "",
            tags=sorted(self.tags),
            language=self.language,
        )

    def to_dict(self) -> dict[str, Any]:
        return self.serialise().model_dump()

    def get_source_pk(self) -> int:
        return self.source.pk

    def get_source_name(self) -> str:
        return self.source.name

    def get_source_external_link(self) -> Optional[str]:
        return self.source.external_link or None

    def get_source_type(self) -> SourceType:
        return SourceType(SourceTypeChoices[self.source.source_type].label)

    def get_source_type_choices(self) -> SourceTypeChoices:
        return SourceTypeChoices.from_source_type_schema(self.get_source_type())

    def get_download_link(self) -> Optional[str]:
        return SourceTypeChoices.get_source_type(self.get_source_type_choices()).get_download_link(self.identifier)

    def get_small_thumbnail_url(self) -> Optional[str]:
        return SourceTypeChoices.get_source_type(self.get_source_type_choices()).get_small_thumbnail_url(
            self.identifier
        )

    def get_medium_thumbnail_url(self) -> Optional[str]:
        return SourceTypeChoices.get_source_type(self.get_source_type_choices()).get_medium_thumbnail_url(
            self.identifier
        )

    class Meta:
        ordering = ["-priority"]


class Tag(models.Model):
    name = models.CharField(unique=True)
    # null=True is just for admin panel
    aliases = ArrayField(models.CharField(max_length=200), default=list, blank=True)
    is_enabled_by_default = models.BooleanField(default=True)
    parent = models.ForeignKey(to="Tag", null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self) -> str:
        return self.name

    def serialise(self) -> SerialisedTag:
        return SerialisedTag(
            name=self.name,
            aliases=self.aliases,
            isEnabledByDefault=self.is_enabled_by_default,
            parent=(self.parent.name if self.parent else None),
            # recursively serialise each child tag
            children=(
                [ChildElement(**x.to_dict()) for x in self.tag_set.order_by("name").all()]
                if self.pk is not None
                else []
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        return self.serialise().model_dump()

    @classmethod
    def get_tags(cls) -> dict[str, list[str]]:
        return {tag.name: tag.aliases for tag in Tag.objects.all()}


class DFCPair(models.Model):
    front = models.CharField(max_length=200, unique=True)
    back = models.CharField(max_length=200)

    def __str__(self) -> str:
        return "{} // {}".format(self.front, self.back)


# https://simpleisbetterthancomplex.com/article/2021/07/08/what-you-should-know-about-the-django-user-model.html


def get_default_cardback() -> Optional[Card]:
    return Card.objects.filter(card_type=CardTypes.CARDBACK).order_by("-priority").first()


class Project(models.Model):
    key = models.UUIDField(default=uuid.uuid4, unique=True)
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

        members: list[ProjectMember] = [
            ProjectMember(card_id=value.get("card_identifier", None), slot=value["slot"], query=query, face=face)
            for face in Faces
            if (face_members := records.get(face, None)) is not None
            for query, values in face_members.items()
            for value in values
        ]
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
    card_id = models.CharField(max_length=200, null=True, blank=True)
    project = models.ForeignKey(to=Project, on_delete=models.CASCADE)
    query = models.CharField(max_length=200)
    slot = models.IntegerField()
    face = models.CharField(max_length=5, choices=Faces.choices, default=Faces.FRONT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["card_id", "project", "slot", "face"], name="projectmember_unique")
        ]

    def to_dict(self) -> dict[str, Any]:
        return {"card_identifier": self.card_id, "query": self.query, "slot": self.slot, "face": self.face}


__all__ = [
    "Faces",
    "CardTypes",
    "Cardstocks",
    "Source",
    "summarise_contributions",
    "Card",
    "Tag",
    "DFCPair",
    "get_default_cardback",
    "Project",
    "ProjectMember",
]
