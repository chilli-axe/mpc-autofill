"""
Locate or download the US Web Coated (SWOP) ICC profile used for DriveThruCards PDF/X-1a output.

Adobe's Color Profile License Agreement permits using the profile and embedding it in image files,
but not redistributing it bundled with application software - so instead of shipping the profile,
we look for a copy already installed on this system and otherwise download Adobe's own end-user
bundle (with the user's consent, accepting Adobe's license terms directly).
"""

import hashlib
import io
import os
import sys
import zipfile
from pathlib import Path
from typing import Optional

import click
import requests

from src.formatting import bold
from src.logging import logger

ICC_PROFILE_FILENAME = "USWebCoatedSWOP.icc"
ADOBE_ICC_BUNDLE_URL = "https://download.adobe.com/pub/adobe/iccprofiles/win/AdobeICCProfilesCS4Win_end-user.zip"
ADOBE_ICC_BUNDLE_MEMBER = f"Adobe ICC Profiles (end-user)/CMYK/{ICC_PROFILE_FILENAME}"
ADOBE_ICC_LICENSE_URL = "https://www.adobe.com/support/downloads/iccprofiles/icc_eula_win_end.html"
ICC_PROFILE_SHA256 = "35f401731df11a4eba3502af632e51d68bc394bcb7d34632a331c1ba3f4a0bf6"


def get_profile_cache_path() -> Path:
    return Path.home() / ".mpc-autofill" / ICC_PROFILE_FILENAME


def _candidate_profile_paths() -> list[Path]:
    home = Path.home()
    if sys.platform == "darwin":
        directories = [
            Path("/Library/Application Support/Adobe/Color/Profiles/Recommended"),
            Path("/Library/ColorSync/Profiles"),
            home / "Library/ColorSync/Profiles",
        ]
    elif sys.platform == "win32":
        system_root = Path(os.environ.get("SystemRoot", r"C:\Windows"))
        program_files = Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
        directories = [
            system_root / "System32/spool/drivers/color",
            program_files / "Common Files/Adobe/Color/Profiles/Recommended",
        ]
    else:
        directories = [Path("/usr/share/color/icc"), home / ".local/share/icc", home / ".color/icc"]
    return [directory / ICC_PROFILE_FILENAME for directory in directories] + [get_profile_cache_path()]


def _download_profile() -> Optional[str]:
    logger.info(f"Downloading the Adobe ICC profile bundle from {bold(ADOBE_ICC_BUNDLE_URL)}...")
    try:
        response = requests.get(ADOBE_ICC_BUNDLE_URL, timeout=120)
        response.raise_for_status()
        profile_bytes = zipfile.ZipFile(io.BytesIO(response.content)).read(ADOBE_ICC_BUNDLE_MEMBER)
    except Exception as exc:
        logger.warning(f"Failed to download the ICC profile: {exc}")
        return None
    if hashlib.sha256(profile_bytes).hexdigest() != ICC_PROFILE_SHA256:
        logger.warning("The downloaded ICC profile did not match the expected checksum - not using it.")
        return None
    cache_path = get_profile_cache_path()
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(profile_bytes)
    logger.info(f"ICC profile saved to {bold(str(cache_path))}.")
    return str(cache_path)


def find_or_download_dtc_icc_profile() -> Optional[str]:
    """
    Return a path to the US Web Coated (SWOP) ICC profile, or None if it's unavailable
    (not installed, and the user declined or the download failed).
    """
    for candidate in _candidate_profile_paths():
        if candidate.is_file():
            return str(candidate)
    logger.info(
        "DriveThruCards colour conversion works best with the US Web Coated (SWOP) ICC profile, "
        "which was not found on this system."
    )
    if not click.confirm(
        f"Download it from Adobe now? (Subject to Adobe's license terms: {ADOBE_ICC_LICENSE_URL})",
        default=True,
    ):
        return None
    return _download_profile()
