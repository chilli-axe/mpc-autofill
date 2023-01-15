import json
import platform
from typing import TypedDict, Union

import requests

from MPCAutofill.settings import PATREON_KEY

# Header must be included to access Patreon info
patreon_header = {
    "Authorization": f"Bearer {PATREON_KEY}",
    "User-Agent": f"Patreon-Python, version 0.5.1, platform {platform.platform()}",
}


class Campaign(TypedDict):
    # Campaign data scheme
    id: str
    about: str


class Supporter(TypedDict):
    # Patron data scheme
    name: str
    tier: str
    date: str


class SupporterTier(TypedDict):
    # Patron tiers data scheme
    title: str
    description: str
    usd: int


def get_patreon_campaign_details() -> tuple[Campaign, dict[str, SupporterTier]]:
    """
    Get needed patreon campaign details.
    :return: Campaign ID, list of dictionaries containing supporter tier info.
    """
    try:
        res = requests.get(
            # https://docs.patreon.com/#get-api-oauth2-v2-campaigns
            url="https://www.patreon.com/api/oauth2/v2/campaigns",
            params={
                "include": "tiers",
                "fields[campaign]": "summary",
                "fields[tier]": ",".join(["title", "description", "amount_cents"]),
            },
            headers=patreon_header,
        ).json()

        # Properly format campaign details
        campaign: Campaign = {"id": res["data"][0]["id"], "about": res["data"][0]["attributes"]["summary"]}

        # Properly format campaign tiers
        tiers: dict[str, SupporterTier] = {}
        for tier in res["included"]:
            # Build dictionary of tiers to reference by ID
            tiers[tier["id"]] = {
                "title": tier["attributes"]["title"],
                "description": tier["attributes"]["description"],
                "usd": round(tier["attributes"]["amount_cents"] / 100),
            }
    except KeyError:
        raise Exception("Cannot locate Patreon campaign. Check Patreon access token!")
    return campaign, tiers


def get_patrons(campaign_id: str, campaign_tiers: dict[str, SupporterTier]) -> list[Supporter]:
    """
    Get our patreon contributors.
    :return: List of dictionaries containing patreon contributor info.
    """
    try:
        members = requests.get(
            # https://docs.patreon.com/#get-api-oauth2-v2-campaigns-campaign_id-members
            url=f"https://www.patreon.com/api/oauth2/v2/campaigns/{campaign_id}/members",
            params={
                "include": "currently_entitled_tiers",
                "fields[member]": ",".join(
                    ["full_name", "campaign_lifetime_support_cents", "pledge_relationship_start", "patron_status"]
                ),
            },
            headers=patreon_header,
        ).json()["data"]

        # Return formatted list of patrons
        return [
            {
                "name": mem["attributes"]["full_name"],
                "tier": campaign_tiers[mem["relationships"]["currently_entitled_tiers"]["data"][0]["id"]]["title"],
                "date": mem["attributes"]["pledge_relationship_start"][:10],
            }
            for mem in members
        ]
    except KeyError:
        raise Exception("Cannot locate Patreon campaign. Check Patreon access token!")
