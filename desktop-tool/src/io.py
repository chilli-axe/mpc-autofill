import io
import os
import sys
import threading
from pathlib import Path
from typing import Any, Optional

import ratelimit
import requests
from googleapiclient.discovery import Resource, build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
from oauth2client.service_account import ServiceAccountCredentials

import src.constants as constants
from src.logging import logger
from src.processing import ImagePostProcessingConfig, post_process_image

thread_local = threading.local()  # Should only be called once per thread


# region Google Drive API


def find_or_create_google_drive_service() -> Resource:
    if (service := getattr(thread_local, "google_drive_service", None)) is None:
        logger.debug("Getting Google Drive API credentials...")
        creds = ServiceAccountCredentials.from_json_keyfile_name(
            str(Path(os.path.abspath(__file__)).parent.parent / constants.SERVICE_ACC_FILENAME), scopes=constants.SCOPES
        )
        service = build("drive", "v3", credentials=creds, static_discovery=False, cache_discovery=False)
        logger.debug("Finished getting Google Drive API credentials - saving to thread local storage.")
        thread_local.google_drive_service = service
    return service


@ratelimit.sleep_and_retry  # type: ignore  # `ratelimit` does not implement decorator typing correctly
@ratelimit.limits(calls=20_000, period=100)  # type: ignore  # `ratelimit` does not implement decorator typing correctly
def execute_google_drive_api_call(service: Resource) -> Optional[dict[str, Any]]:
    try:
        return service.execute()
    except HttpError:
        return None


# endregion

# region network IO


@ratelimit.sleep_and_retry  # type: ignore  # `ratelimit` does not implement decorator typing correctly
@ratelimit.limits(calls=1, period=0.1)  # type: ignore  # `ratelimit` does not implement decorator typing correctly
def rate_limit_api_call(
    url: str, method: str, data: dict[str, Any], params: dict[str, Any], timeout: Optional[int] = None
) -> requests.Response:
    with requests.request(url=url, method=method, data=data, params=params, timeout=timeout) as r_info:
        return r_info


def rate_limit_get_api_call(url: str, params: dict[str, Any], timeout: Optional[int] = None) -> requests.Response:
    return rate_limit_api_call(url=url, method="GET", data={}, params=params, timeout=timeout)


def rate_limit_post_api_call(url: str, data: dict[str, Any], timeout: Optional[int] = None) -> requests.Response:
    return rate_limit_api_call(url=url, method="POST", data=data, params={}, timeout=timeout)


def safe_get_api_call(
    url: str, params: dict[str, Any], max_tries: int = 3, timeout: Optional[int] = None
) -> Optional[str]:
    tries = 0
    while True:
        try:
            r_info = rate_limit_get_api_call(url=url, params=params, timeout=timeout)
            r_text = r_info.text
            # validate contents of response
            if r_info.status_code == 200 and len(r_text) > 0:
                return r_text
        except (requests.exceptions.RequestException, TimeoutError):
            pass

        tries += 1
        if tries >= max_tries:
            return None


def safe_post_api_call(
    url: str, data: dict[str, Any], expected_keys: set[str], max_tries: int = 3, timeout: Optional[int] = None
) -> Optional[dict[str, Any]]:
    tries = 0
    while True:
        try:
            r_info = rate_limit_post_api_call(url=url, data=data, timeout=timeout)
            r_json = r_info.json()
            # validate contents of response
            if (
                r_info.status_code == 200
                and len(expected_keys - r_json.keys()) == 0
                and not any([bool(r_json[x]) is False for x in expected_keys])
            ):
                return r_json
        except (requests.exceptions.RequestException, TimeoutError):
            pass

        tries += 1
        if tries >= max_tries:
            return None


def get_google_drive_file_name(drive_id: str) -> Optional[str]:
    """
    Retrieve the name for the Google Drive file identified by `drive_id`.
    """

    if not drive_id:
        return None
    service = find_or_create_google_drive_service()
    response = execute_google_drive_api_call(service.files().get(fileId=drive_id))
    return response["name"] if response is not None else None


# endregion

# region file IO


# TODO: migrate to Pathlib
DEFAULT_WORKING_DIRECTORY: str = (
    os.path.dirname(os.path.realpath(sys.executable)) if getattr(sys, "frozen", False) else os.getcwd()
)


def get_image_directory(working_directory: str) -> str:
    return os.path.join(working_directory, "cards")


def create_image_directory_if_not_exists(working_directory: str) -> bool:
    if not os.path.exists(get_image_directory(working_directory=working_directory)):
        os.mkdir(get_image_directory(working_directory=working_directory))
        return True
    return False


def file_exists(file_path: Optional[str]) -> bool:
    return file_path is not None and file_path != "" and os.path.isfile(file_path) and os.path.getsize(file_path) > 0


def remove_directories(directory_list: list[str]) -> None:
    for directory in directory_list:
        try:
            os.rmdir(directory)
        except Exception:  # TODO: investigate which exceptions `os.rmdir` can raise and handle specifically them
            pass


def remove_files(file_list: list[str]) -> None:
    for file in file_list:
        try:
            os.remove(file)
        except Exception:  # TODO: investigate which exceptions `os.remove` can raise and handle specifically them
            pass


# endregion

# region mixed network and file IO


def download_google_drive_file(
    drive_id: str, file_path: str, post_processing_config: Optional[ImagePostProcessingConfig]
) -> bool:
    """
    Download the Google Drive file identified by `drive_id` to the specified `file_path`.
    Returns whether the request was successful or not.
    """

    logger.debug(f"Downloading Google Drive image {drive_id}...")
    service = find_or_create_google_drive_service()
    request = service.files().get_media(fileId=drive_id)
    file = io.BytesIO()
    downloader = MediaIoBaseDownload(file, request)
    try:
        done = False
        while done is False:
            _, done = downloader.next_chunk()
        file_bytes = file.getvalue()
    except HttpError:
        logger.exception(f"Encountered a HTTP error while downloading Google Drive image {drive_id}")
        return False

    if post_processing_config is not None:
        logger.debug(f"Post-processing {drive_id}...")
        processed_image = post_process_image(raw_image=file_bytes, config=post_processing_config)
        processed_image.save(file_path)
    else:
        # Save the bytes directly to disk - avoid reading in pillow in case any quality degradation occurs
        with open(file_path, "wb") as f:
            f.write(file_bytes)
    logger.debug(f"Finished downloading Google Drive image {drive_id}!")
    return True


# endregion
