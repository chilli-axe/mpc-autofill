from typing import TYPE_CHECKING, Optional, Type

import googleapiclient.errors
from attr import define
from tqdm import tqdm

from django.db.models import TextChoices
from django.utils.dateparse import parse_datetime
from django.utils.timezone import now
from django.utils.translation import gettext_lazy

from cardpicker.schema_types import SourceType as SchemaSourceType
from cardpicker.sources.api import (
    Folder,
    Image,
    execute_google_drive_api_call,
    find_or_create_google_drive_service,
)

if TYPE_CHECKING:
    from cardpicker.models import Source


@define
class SourceType:
    @staticmethod
    def get_identifier() -> "SourceTypeChoices":
        """
        Map this source type to the `SourceTypeChoices` enum (the `Source` table has a field for `SourceTypeChoices`).
        """

        raise NotImplementedError

    @staticmethod
    def get_download_link(identifier: str) -> Optional[str]:
        """
        Return the download link for a Card, Cardback, or Token object identified by `identifier`.
        Return None if providing a download link isn't possible or doesn't make sense.
        """

        raise NotImplementedError

    @staticmethod
    def get_small_thumbnail_url(identifier: str) -> str:
        """
        Return the small thumbnail URL for a Card, Cardback, or Token object identified by `identifier`.
        This URL will be used when displaying the image in the frontend grid views.
        """

        raise NotImplementedError

    @staticmethod
    def get_medium_thumbnail_url(identifier: str) -> str:
        """
        Return the medium thumbnail URL for a Card, Cardback, or Token object identified by `identifier`.
        This URL will be used when displaying the image in the frontend detailed view modal.
        """

        raise NotImplementedError

    @staticmethod
    def get_all_folders(sources: list["Source"]) -> dict[str, Optional[Folder]]:
        """
        Given the list of `Source` objects which are of this source type, create and return a dictionary
        which maps each source's key to a `Folder` object representing the root folder of that source
        (or None if the source is invalid for whatever reason).
        This will probably involve API calls.
        """

        raise NotImplementedError

    @staticmethod
    def get_all_folders_inside_folder(folder: Folder) -> list[Folder]:
        """
        Return a list of folders inside `folder`. This will probably involve API calls.
        """

        raise NotImplementedError

    @staticmethod
    def get_all_images_inside_folder(folder: Folder) -> list[Image]:
        """
        Return a list of images inside `folder`. This will probably involve API calls.
        """
        raise NotImplementedError


class GoogleDrive(SourceType):
    @staticmethod
    def get_identifier() -> "SourceTypeChoices":
        return SourceTypeChoices.GOOGLE_DRIVE

    @staticmethod
    def get_download_link(identifier: str) -> Optional[str]:
        return f"https://drive.google.com/uc?id={identifier}&export=download"

    @staticmethod
    def get_small_thumbnail_url(identifier: str) -> str:
        return f"https://drive.google.com/thumbnail?sz=w400-h400&id={identifier}"

    @staticmethod
    def get_medium_thumbnail_url(identifier: str) -> str:
        return f"https://drive.google.com/thumbnail?sz=w800-h800&id={identifier}"

    @staticmethod
    def get_all_folders(sources: list["Source"]) -> dict[str, Optional[Folder]]:
        service = find_or_create_google_drive_service()
        print("Retrieving Google Drive folders...")
        bar = tqdm(total=len(sources))
        folders: dict[str, Optional[Folder]] = {}
        error_drives = []
        for x in sources:
            try:
                if folder := execute_google_drive_api_call(service.files().get(fileId=x.identifier)):
                    folders[x.key] = Folder(id=folder["id"], name=folder["name"], parent=None)
                else:
                    raise KeyError
            except (googleapiclient.errors.HttpError, KeyError):
                folders[x.key] = None
                error_drives.append(x.key)
            finally:
                bar.update(1)

        print("...and done!")
        if error_drives:
            print(f"Failed to connect to the following drives: {', '.join(error_drives)}")
        return folders

    @staticmethod
    def get_all_folders_inside_folder(folder: Folder) -> list[Folder]:
        service = find_or_create_google_drive_service()
        results = execute_google_drive_api_call(
            service.files().list(
                q="mimeType='application/vnd.google-apps.folder' and " f"'{folder.id}' in parents",
                fields="files(id, name, parents)",
                pageSize=500,
            )
        )
        folders = [Folder(id=x["id"], name=x["name"], parent=folder) for x in results.get("files", [])]
        return folders

    @staticmethod
    def get_all_images_inside_folder(folder: Folder) -> list[Image]:
        service = find_or_create_google_drive_service()
        page_token = None
        images = []
        while True:
            # continue to query the gdrive API until all pages have been read
            results = execute_google_drive_api_call(
                service.files().list(
                    q="(mimeType contains 'image/png' or "
                    "mimeType contains 'image/jpg' or "
                    "mimeType contains 'image/jpeg') and "
                    f"'{folder.id}' in parents",
                    fields="nextPageToken, files("
                    "id, name, trashed, size, parents, createdTime, modifiedTime, imageMediaMetadata"
                    ")",
                    pageSize=500,
                    pageToken=page_token,
                )
            )

            image_results = results.get("files", [])
            if len(image_results) == 0:
                break
            for item in image_results:
                if not item["trashed"]:
                    images.append(
                        Image(
                            id=item["id"],
                            name=item["name"],
                            created_time=parse_datetime(item["createdTime"]) or now(),
                            modified_time=parse_datetime(item["modifiedTime"]) or now(),
                            folder=folder,
                            height=item["imageMediaMetadata"]["height"],
                            size=int(item["size"]),
                        )
                    )

            page_token = results.get("nextPageToken", None)
            if page_token is None:
                break
        return images


class LocalFile(SourceType):
    @staticmethod
    def get_identifier() -> "SourceTypeChoices":
        return SourceTypeChoices.LOCAL_FILE


class AWSS3(SourceType):
    @staticmethod
    def get_identifier() -> "SourceTypeChoices":
        return SourceTypeChoices.AWS_S3


class SourceTypeChoices(TextChoices):
    """
    Unique identifier for a Source type.
    """

    GOOGLE_DRIVE = (
        SchemaSourceType.GoogleDrive.value.upper().replace(" ", "_"),
        gettext_lazy(SchemaSourceType.GoogleDrive.value),
    )
    LOCAL_FILE = (
        SchemaSourceType.LocalFile.value.upper().replace(" ", "_"),
        gettext_lazy(SchemaSourceType.LocalFile.value),
    )
    AWS_S3 = (SchemaSourceType.AWSS3.value.upper().replace(" ", "_"), gettext_lazy(SchemaSourceType.AWSS3.value))

    @classmethod
    def from_source_type_schema(cls, source_type: SchemaSourceType) -> "SourceTypeChoices":
        return SourceTypeChoices[source_type.value.upper().replace(" ", "_")]

    @classmethod
    def get_source_type(cls, source_type: "SourceTypeChoices") -> Type[SourceType]:
        source_type_or_none = {x.get_identifier(): x for x in [GoogleDrive, LocalFile, AWSS3]}.get(source_type)
        if source_type_or_none is None:
            raise Exception(f"Incorrect configuration of source types means {source_type} isn't mapped")
        return source_type_or_none


__all__ = ["SourceType", "SourceTypeChoices", "GoogleDrive", "LocalFile", "AWSS3"]
