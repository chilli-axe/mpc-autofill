from typing import Any

from django.core.management.base import BaseCommand

from cardpicker.integrations.integrations import get_configured_game_integration


class Command(BaseCommand):
    help = "Imports canonical artists and cards for the configured game integration."

    def handle(self, *args: Any, **kwargs: Any) -> None:
        game_integration = get_configured_game_integration()
        if game_integration is None:
            raise Exception("No game integration is configured.")
        game_integration.import_canonical_cards_and_artists()
