import operator
import platform
from typing import Optional, TypedDict

import requests

from MPCAutofill.settings import PATREON_ACCESS, PATREON_URL

# Header must be included to access Patreon info
patreon_header = {
    "Authorization": f"Bearer {PATREON_ACCESS}",
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
    usd: int


class SupporterTier(TypedDict):
    # Patron tiers data scheme
    title: str
    description: str
    usd: int


def get_patreon_campaign_details() -> tuple[Optional[Campaign], Optional[dict[str, SupporterTier]]]:
    """
    Get needed patreon campaign details.
    :return: Campaign ID, list of dictionaries containing supporter tier info.
    """

    if not PATREON_URL:
        return None, None

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
            # Ignore free tier
            if tier["attributes"]["amount_cents"] < 1:
                continue
            # Build dictionary of tiers to reference by ID
            tiers[tier["id"]] = {
                "title": tier["attributes"]["title"],
                "description": tier["attributes"]["description"],
                "usd": round(tier["attributes"]["amount_cents"] / 100),
            }
    except KeyError:
        print("Warning: Cannot locate Patreon campaign. Check Patreon access token!")
        return None, None
    return campaign, tiers


def get_patrons(
    campaign_id: str, campaign_tiers: dict[str, SupporterTier], next_page: Optional[str] = None
) -> Optional[list[Supporter]]:
    """
    Get our patreon contributors.
    :return: List of dictionaries containing patreon contributor info.
    """

    if not PATREON_URL:
        return None

    try:
        req = (
            requests.get(
                # https://docs.patreon.com/#get-api-oauth2-v2-campaigns-campaign_id-members
                f"https://www.patreon.com/api/oauth2/v2/campaigns/{campaign_id}/members",
                params={
                    "include": "currently_entitled_tiers",
                    "fields[member]": ",".join(
                        ["full_name", "campaign_lifetime_support_cents", "pledge_relationship_start", "patron_status"]
                    ),
                },
                headers=patreon_header,
            )
            if next_page is None
            else requests.get(next_page, headers=patreon_header)
        )
        res = req.json()

        # Ready the next page if provided
        next_page = res.get("links", {}).get("next")

        # Return formatted list of patrons
        results: list[Supporter] = []
        for mem in res["data"]:

            # Skip non-active members
            if mem["attributes"]["patron_status"] != "active_patron":
                continue

            # Skip members with no tiers
            tiers = mem.get("relationships", {}).get("currently_entitled_tiers", {}).get("data", [])
            if not tiers:
                continue

            # Figure out highest paid tier
            highest: Optional[SupporterTier] = None
            for t in tiers:

                # Skip if tier not recognized
                if t.get("id", "#") not in campaign_tiers:
                    continue

                # This tier is highest
                tier = campaign_tiers[t["id"]]
                if not highest or highest.get("usd", 0) < t["usd"]:
                    highest = SupporterTier(**tier)

            # Skip if no highest tier calculated
            if not highest:
                continue

            # Add member to results
            results.append(
                Supporter(
                    name=mem["attributes"]["full_name"],
                    tier=highest["title"],
                    date=mem["attributes"]["pledge_relationship_start"][:10],
                    usd=highest["usd"],
                )
            )

        # Check if there's additional pages of results
        if next_page:
            results.extend(
                get_patrons(campaign_id=campaign_id, campaign_tiers=campaign_tiers, next_page=next_page) or []
            )

        # Return sorted results
        return sorted(results, key=operator.itemgetter("usd"), reverse=True)

    # Unable to retrieve patrons
    except KeyError:
        print("Warning: Cannot locate Patreon campaign. Check Patreon access token!")
        return None


__all__ = ["Campaign", "Supporter", "SupporterTier", "get_patreon_campaign_details", "get_patrons"]
