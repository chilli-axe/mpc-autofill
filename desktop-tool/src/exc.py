from src.formatting import bold
from src.logging import CRASH_LOG_FILENAME


class InvalidStateException(Exception):
    # TODO: recovery from invalid state?
    def __init__(self, state: str, expected_state: str):
        self.message = (
            f"Expected the driver to be in the state {bold(expected_state)} but the driver is in the "
            f"state {bold(state)}"
        )
        super().__init__(self.message)


class ValidationException(Exception):
    pass


class ImageDownloadError(Exception):
    def __init__(self, failed_images: list[tuple[str, str]]) -> None:
        failed_list = "\n".join(
            f"- {name or 'Unknown image'}" + (f" (Drive ID: {drive_id})" if drive_id else "")
            for name, drive_id in failed_images
        )
        super().__init__(
            "Some card images could not be downloaded, so PDF creation has stopped.\n"
            f"{failed_list}\n\n"
            "This usually means the saved XML refers to an image that was removed or replaced after the order "
            "was created. Import this XML into a new MPC Fill project to identify the unmatched cards and choose "
            "replacements, then download a new XML and try again. Technical details were saved to "
            f"{CRASH_LOG_FILENAME}."
        )
