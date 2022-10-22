from typing import Any

from django.core.management.base import BaseCommand
from django.db.models import Sum

from cardpicker.models import Card


class Command(BaseCommand):
    help = "Returns the total size of all images in the database"

    def handle(self, *args: Any, **kwargs: dict[str, Any]) -> None:
        # store as GB
        card_size = round(Card.objects.aggregate(Sum("size"))["size__sum"] / 1_000_000_000)
        print(f"Total size: {(card_size)/1000} TB")
