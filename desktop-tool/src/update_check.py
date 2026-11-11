"""Optional startup notifications for stable GitHub releases."""

import json
import os
import re
import sys
import tempfile
import webbrowser
from http.client import HTTPException
from pathlib import Path
from typing import Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

import click

from src import build_info


def parse_release_version(tag: str) -> Optional[tuple[int, ...]]:
    match = re.fullmatch(r"(?:dtc-)?v?([0-9]+(?:\.[0-9]+){1,3})", tag)
    if match is None:
        return None
    parts = tuple(int(part) for part in match[1].split("."))
    return parts + (0,) * (4 - len(parts))


def get_preference_path(repository: str) -> Path:
    return Path(click.get_app_dir("mpc-autofill")) / "update-checks" / f"{repository.lower()}.json"


def read_preference(path: Path) -> Optional[bool]:
    try:
        preference = json.loads(path.read_text(encoding="utf-8"))
    except OSError, ValueError, RecursionError:
        return None
    if isinstance(preference, dict):
        enabled = preference.get("enabled")
        if isinstance(enabled, bool):
            return enabled
    return None


def save_preference(path: Path, enabled: bool) -> None:
    temporary_path = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as temporary:
            temporary_path = Path(temporary.name)
            json.dump({"enabled": enabled}, temporary)
            temporary.write("\n")
        os.replace(temporary_path, path)
    except OSError:
        click.echo("Could not save the update-check preference; it applies only to this run.", err=True)
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass


def check_for_updates(enabled: Optional[bool] = None) -> bool:
    """Return True when the user opened an update page and wants to stop this run."""
    version, repository = build_info.VERSION, build_info.RELEASE_REPOSITORY
    if version is None or repository is None:
        return False
    current_version = parse_release_version(version)
    if current_version is None:
        return False

    interactive = sys.stdin.isatty() and sys.stdout.isatty()
    if enabled is None and not interactive:
        return False
    preference_path = get_preference_path(repository)
    if enabled is not None:
        save_preference(preference_path, enabled)
    else:
        enabled = read_preference(preference_path)
        if enabled is None:
            enabled = click.confirm(
                f"Check GitHub ({repository}) for new versions on startup? "
                "This contacts GitHub. Your choice is remembered across upgrades",
                default=False,
            )
            save_preference(preference_path, enabled)
    if not enabled:
        return False

    request = Request(
        f"https://api.github.com/repos/{repository}/releases/latest",
        headers={"Accept": "application/vnd.github+json", "User-Agent": "mpc-autofill"},
    )
    try:
        with urlopen(request, timeout=3) as response:
            release = json.load(response)
        if not isinstance(release, dict) or release.get("draft") is not False or release.get("prerelease") is not False:
            return False
        tag = release.get("tag_name")
        latest_version = parse_release_version(tag) if isinstance(tag, str) else None
    except URLError, OSError, ValueError, HTTPException, RecursionError:
        click.echo("Update check unavailable; continuing with this version.", err=True)
        return False
    if latest_version is None or latest_version <= current_version:
        return False

    release_url = f"https://github.com/{repository}/releases/tag/{tag}"
    click.echo(f"MPC Autofill {tag} is available (installed: {version}).\nDownload: {release_url}")
    if interactive and click.confirm("Open the release page to download it and stop this run?", default=True):
        try:
            if webbrowser.open(release_url):
                return True
        except webbrowser.Error, OSError:
            pass
        click.echo("Could not open a browser. Use the download link above; continuing with this version.", err=True)
    return False
