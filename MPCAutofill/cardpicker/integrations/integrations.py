from typing import Optional, Type

from cardpicker.integrations.base import GameIntegration
from cardpicker.integrations.mtg import MTG

from MPCAutofill.settings import GAME


def get_configured_game_integration() -> Optional[Type[GameIntegration]]:
    integrations: dict[str, Type[GameIntegration]] = {integration.__name__: integration for integration in [MTG]}
    return integrations.get(GAME) if GAME else None
