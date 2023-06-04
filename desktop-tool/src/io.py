import base64
import os
import sys
from typing import Any, Optional

import ratelimit
import requests

import src.constants as constants
from src.processing import ImagePostProcessingConfig, post_process_image

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
            if r_info.status_code != 500 and len(r_text) > 0:
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
                r_info.status_code != 500
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
    response = safe_post_api_call(
        url=constants.GoogleScriptsAPIs.image_name, data={"id": drive_id}, timeout=30, expected_keys={"name"}
    )
    return response["name"] if response is not None else None


# endregion

# region file IO


CURRDIR: str = os.path.dirname(os.path.realpath(sys.executable)) if getattr(sys, "frozen", False) else os.getcwd()


def image_directory() -> str:
    cards_folder = os.path.join(CURRDIR, "cards")
    if not os.path.exists(cards_folder):
        os.mkdir(cards_folder)
    return cards_folder


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

    response = safe_get_api_call(url=constants.GoogleScriptsAPIs.image_content, params={"id": drive_id}, timeout=5 * 60)
    if response is not None and len(response) > 0:
        file_bytes = base64.b64decode(response)
        if post_processing_config is not None:
            processed_image = post_process_image(raw_image=file_bytes, config=post_processing_config)
            processed_image.save(file_path)
        else:
            # Save the bytes directly to disk - avoid reading in pillow in case any quality degradation occurs
            with open(file_path, "wb") as f:
                f.write(file_bytes)
        return True
    return False


# endregion
