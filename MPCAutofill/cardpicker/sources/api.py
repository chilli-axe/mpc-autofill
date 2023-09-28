import datetime as dt
import functools
import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import pycountry
import ratelimit
from googleapiclient.discovery import Resource, build
from googleapiclient.errors import HttpError
from oauth2client.service_account import ServiceAccountCredentials

from cardpicker.search import sanitisation
from cardpicker.tags import Tags

thread_local = threading.local()  # Should only be called once per thread


@dataclass
class Folder:
    id: str
    name: str
    parent: Optional["Folder"]

    @functools.cached_property
    def top_level_folder(self) -> "Folder":
        if self.parent is None:
            return self
        return self.parent.top_level_folder

    def get_full_path(self, tags: Tags) -> str:
        _, name, _ = self.unpack_name(tags=tags)
        if self.parent is None:
            return name
        return f"{self.parent.get_full_path(tags=tags)} / {name}"

    def unpack_name(self, tags: Tags) -> tuple[Optional[pycountry.Languages], str, set[str]]:
        """
        The folder's name is unpacked according to the below schema. For example, consider `{EN} Cards [NSFW]`:
             {EN}              Cards         [NSFW]
        └─ language ──┘ └─ folder name ──┘ └─ tags ──┘
        """

        folder_name_results = re.compile(r"^(?:\{(.+)\} )?(.*?)$").search(self.name)
        assert folder_name_results is not None
        language_code, name = folder_name_results.groups()
        language = pycountry.languages.get(alpha_2=language_code) if language_code else None
        name_with_no_tags, extracted_tags = tags.extract_name_and_tags(name)
        return language, sanitisation.fix_whitespace(name_with_no_tags), extracted_tags

    def get_language(self, tags: Tags) -> Optional[pycountry.Languages]:
        language, _, _ = self.unpack_name(tags=tags)
        if self.parent is None:
            return language
        return language if language is not None else self.parent.get_language(tags=tags)

    def get_tags(self, tags: Tags) -> set[str]:
        _, _, extracted_tags = self.unpack_name(tags=tags)
        if self.parent is None:
            return extracted_tags
        return self.parent.get_tags(tags=tags) | extracted_tags


@dataclass
class Image:
    id: str
    name: str
    size: int
    created_time: dt.datetime
    height: int
    folder: Folder

    def unpack_name(self, tags: Tags) -> tuple[pycountry.Languages, str, set[str], str]:
        """
        The image's name is unpacked according to the below schema. For example, consider `{EN} Opt [NSFW].png`:
             {EN}             opt          [NSFW]   .      png
        └─ language ──┘ └─ card name ──┘ └─ tags ──┘ └─ extension ──┘
        """

        assert self.name, "File name is empty string"
        assert "." in self.name, "File name has no extension"
        extensionless_name, extension = self.name.rsplit(".", 1)
        image_name_results = re.compile(r"^(?:\{(.+)\} )?(.*?)$").search(extensionless_name)
        assert image_name_results is not None
        language_code, name = image_name_results.groups()
        language = pycountry.languages.get(alpha_2=language_code) if language_code else None
        name_with_no_tags, extracted_tags = tags.extract_name_and_tags(name)
        return language, sanitisation.fix_whitespace(name_with_no_tags), extracted_tags, extension

    def get_language(self, tags: Tags) -> pycountry.Languages:
        language, _, _, _ = self.unpack_name(tags=tags)
        return language if language is not None else self.folder.get_language(tags=tags)

    def get_tags(self, tags: Tags) -> set[str]:
        _, _, image_tags, _ = self.unpack_name(tags=tags)
        return image_tags | self.folder.get_tags(tags=tags)


# region google drive API
# Google Drive API usage limits reference: https://developers.google.com/drive/api/guides/limits


# If modifying these scopes, delete the file token.pickle.
SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/drive.readonly"]

SERVICE_ACC_FILENAME = "client_secrets.json"


def find_or_create_google_drive_service() -> Resource:
    if (service := getattr(thread_local, "google_drive_service", None)) is None:
        creds = ServiceAccountCredentials.from_json_keyfile_name(
            str(Path(os.path.abspath(__file__)).parent.parent.parent / SERVICE_ACC_FILENAME), scopes=SCOPES
        )
        service = build("drive", "v3", credentials=creds)
        thread_local.google_drive_service = service
    return service


@ratelimit.sleep_and_retry  # type: ignore  # `ratelimit` does not implement decorator typing correctly
@ratelimit.limits(calls=20_000, period=100)  # type: ignore  # `ratelimit` does not implement decorator typing correctly
def execute_google_drive_api_call(service: Resource) -> Optional[dict[str, Any]]:
    try:
        return service.execute()
    except HttpError:
        return {}


# endregion

__all__ = ["Image", "Folder", "find_or_create_google_drive_service", "execute_google_drive_api_call"]
