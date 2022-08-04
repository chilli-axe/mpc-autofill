import datetime as dt
import threading
from dataclasses import dataclass
from typing import Any, Optional

import ratelimit
from googleapiclient.discovery import Resource, build
from googleapiclient.errors import HttpError
from oauth2client.service_account import ServiceAccountCredentials

thread_local = threading.local()  # Should only be called once per thread


@dataclass
class Folder:
    id: str
    name: str
    parents: list[str]


@dataclass
class Image:
    id: str
    name: str
    size: int
    # parent: str
    created_time: dt.datetime
    height: int
    folder: Folder


# region google drive API
# Google Drive API usage limits reference: https://developers.google.com/drive/api/guides/limits


# If modifying these scopes, delete the file token.pickle.
SCOPES = [
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

SERVICE_ACC_FILENAME = "client_secrets.json"


def find_or_create_google_drive_service() -> Resource:
    if (service := getattr(thread_local, "google_drive_service", None)) is None:
        creds = ServiceAccountCredentials.from_json_keyfile_name(SERVICE_ACC_FILENAME, scopes=SCOPES)
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
