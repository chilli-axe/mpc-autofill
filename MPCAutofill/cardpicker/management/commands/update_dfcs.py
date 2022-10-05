from typing import Any

from django.core.management.base import BaseCommand

from cardpicker.dfc_pairs import sync_dfcs


class Command(BaseCommand):
    # set up help line to print the available drive options
    help = "Synchronises stored double-faced card pairs with Scryfall database."

    def handle(self, *args: Any, **kwargs: Any) -> None:
        sync_dfcs()
