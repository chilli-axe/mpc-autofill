from typing import Optional, Type

from django.conf import settings

from cardpicker.integrations.game.base import GameIntegration
from cardpicker.integrations.game.mtg import MTGIntegration


def get_configured_game_integration() -> Optional[Type[GameIntegration]]:
    integrations: dict[str, Type[GameIntegration]] = {
        integration.get_game().value: integration for integration in [MTGIntegration]
    }
    return integrations.get(settings.GAME) if settings.GAME else None
