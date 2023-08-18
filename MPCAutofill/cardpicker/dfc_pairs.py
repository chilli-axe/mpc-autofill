import time

from bulk_sync import bulk_sync

from cardpicker.integrations.integrations import get_configured_game_integration
from cardpicker.models import DFCPair


def sync_dfcs() -> None:
    t0 = time.time()
    game_integration = get_configured_game_integration()
    if game_integration is None:
        print("There is no game configured - no DFC pairs have been imported.")
        return
    dfc_pairs = game_integration.get_dfc_pairs()
    key_fields = ("front",)
    bulk_sync(new_models=dfc_pairs, key_fields=key_fields, filters=None, db_class=DFCPair)
    print(f"Finished importing DFC pairs - this task took {(time.time() - t0):.2f} seconds.")
