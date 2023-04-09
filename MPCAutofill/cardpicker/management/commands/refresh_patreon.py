import os.path
import platform
from typing import Any

import dotenv
import requests

from django.core.management.base import BaseCommand

from MPCAutofill.settings import (
    BASE_DIR,
    PATREON_CLIENT,
    PATREON_REFRESH,
    PATREON_SECRET,
)

patreon_header = {
    "User-Agent": f"Patreon-Python, version 0.5.1, platform {platform.platform()}",
}


class Command(BaseCommand):
    help = "Refreshes the Patreon access token"

    def handle(self, *args: Any, **kwargs: dict[str, Any]) -> None:
        # TODO: Potentially more secure to store these keys in database?
        # Make a request to refresh the Patreon access token
        res = requests.post(
            # https://docs.patreon.com/#step-7-keeping-up-to-date
            url="https://www.patreon.com/api/oauth2/token",
            params={
                "grant_type": "refresh_token",
                "refresh_token": PATREON_REFRESH,
                "client_id": PATREON_CLIENT,
                "client_secret": PATREON_SECRET,
            },
            headers=patreon_header,
        ).json()

        # Were the tokens received?
        if "access_token" not in res or "refresh_token" not in res:
            print(f"Response: {res}")
            raise KeyError("Patreon response missing access_token or key_token!")

        # Set access token
        dotenv.set_key(
            os.path.join(BASE_DIR, "MPCAutofill/.env"), "PATREON_ACCESS", res["access_token"], quote_mode="never"
        )

        # Set refresh token
        dotenv.set_key(
            os.path.join(BASE_DIR, "MPCAutofill/.env"), "PATREON_REFRESH", res["refresh_token"], quote_mode="never"
        )

        # Notify user
        print("Patreon Access and Refresh tokens updated successfully!")
