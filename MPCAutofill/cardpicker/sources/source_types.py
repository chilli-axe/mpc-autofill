from typing import TYPE_CHECKING, Optional, Type

import googleapiclient.errors
from attr import define
from cardpicker.sources.api import (
    Folder,
    Image,
    execute_google_drive_api_call,
    find_or_create_google_drive_service,
)
from django.db.models import TextChoices
from django.utils.translation import gettext_lazy
from tqdm import tqdm

if TYPE_CHECKING:
    from cardpicker.models import Source


@define
class SourceType:
    @staticmethod
    def get_identifier() -> "SourceTypeChoices":
        raise NotImplementedError

    @staticmethod
    def get_description() -> str:
        raise NotImplementedError

    @staticmethod
    def get_download_link(identifier: str) -> Optional[str]:
        raise NotImplementedError

    @staticmethod
    def get_all_folders(sources: list["Source"]) -> dict[str, Optional[Folder]]:
        raise NotImplementedError

    @staticmethod
    def get_all_folders_inside_folder(folder: Folder) -> list[Folder]:
        raise NotImplementedError

    @staticmethod
    def get_all_images_inside_folder(folder: Folder) -> list[Image]:
        raise NotImplementedError


class GoogleDrive(SourceType):
    @staticmethod
    def get_identifier() -> "SourceTypeChoices":
        return SourceTypeChoices.GOOGLE_DRIVE

    @staticmethod
    def get_description() -> str:
        return "whatever"  # TODO

    @staticmethod
    def get_download_link(identifier: str) -> Optional[str]:
        return f"https://drive.google.com/uc?id={identifier}&export=download"

    @staticmethod
    def get_all_folders(sources: list["Source"]) -> dict[str, Optional[Folder]]:
        service = find_or_create_google_drive_service()
        print("Retrieving Google Drive folders...")
        bar = tqdm(total=len(sources))
        folders: dict[str, Optional[Folder]] = {}
        for x in sources:
            try:
                if (folder := execute_google_drive_api_call(service.files().get(fileId=x.identifier))) is not None:
                    folders[x.key] = Folder(id=folder["id"], name=folder["name"], parents=[])
                else:
                    raise googleapiclient.errors.HttpError
            except googleapiclient.errors.HttpError:
                folders[x.key] = None
                print(f"Failed on drive: {x.key}")
            finally:
                bar.update(1)

        print("...and done!")
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
        folders = [Folder(id=x["id"], name=x["name"], parents=x["parents"]) for x in results.get("files", [])]
        return folders

    @staticmethod
    def get_all_images_inside_folder(folder: Folder) -> list[Image]:
        service = find_or_create_google_drive_service()
        page_token = None
        images = []
        while True:
            results = execute_google_drive_api_call(
                service.files().list(
                    q="(mimeType contains 'image/png' or "
                    "mimeType contains 'image/jpg' or "
                    "mimeType contains 'image/jpeg') and "
                    f"'{folder.id}' in parents",
                    fields="nextPageToken, files("
                    "id, name, trashed, size, parents, createdTime, imageMediaMetadata"
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
                            created_time=item["createdTime"],
                            folder=folder,
                            height=item["imageMediaMetadata"]["height"],
                            size=item["size"],
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

    GOOGLE_DRIVE = ("GOOGLE_DRIVE", gettext_lazy("Google Drive"))
    LOCAL_FILE = ("LOCAL_FILE", gettext_lazy("Local File"))
    AWS_S3 = ("AWS_S3", gettext_lazy("AWS S3"))

    def get_source_type(self) -> Type[SourceType]:
        source_type_or_none = {x.get_identifier(): x for x in [GoogleDrive, LocalFile, AWSS3]}.get(self)
        if source_type_or_none is None:
            raise Exception(f"Incorrect configuration of source types means {self} isn't mapped")
        return source_type_or_none


__all__ = ["Folder", "Image", "SourceType", "SourceTypeChoices", "GoogleDrive", "LocalFile", "AWSS3"]
