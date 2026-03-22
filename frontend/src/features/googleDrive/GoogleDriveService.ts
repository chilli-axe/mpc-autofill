import { GoogleDriveFile, GoogleDriveImageMimeTypes } from "@/common/types";

interface GoogleDriveGetFoldersInsideFolderRequest {
  folderId: string;
}
interface GoogleDriveGetFoldersInsideFolderResponse {
  files: Array<Pick<GoogleDriveFile, "id" | "name">>;
}

interface GoogleDriveGetImagesInsideFolderRequest {
  folderId: string;
  pageToken: string | undefined;
}
interface GoogleDriveGetImagesInsideFolderResponse {
  files: Array<
    Pick<
      GoogleDriveFile,
      "id" | "name" | "trashed" | "size" | "modifiedTime" | "imageMediaMetadata"
    >
  >;
  nextPageToken?: string;
}

interface GoogleDriveGetFileByIdRequest {
  fileId: string;
}
type GoogleDriveGetFileByIdResponse = Pick<
  GoogleDriveFile,
  | "id"
  | "name"
  | "trashed"
  | "size"
  | "modifiedTime"
  | "imageMediaMetadata"
  | "parents"
>;

export class GoogleDriveService {
  bearerToken: string;
  constructor(bearerToken: string) {
    this.bearerToken = bearerToken;
  }

  async executeCall(resource: string, params: URLSearchParams) {
    return fetch(`https://www.googleapis.com/drive/v3/${resource}?${params}`, {
      headers: { Authorization: `Bearer ${this.bearerToken}` },
      method: "GET",
    }).then((r) => r.json());
  }

  async getFoldersInsideFolder(
    request: GoogleDriveGetFoldersInsideFolderRequest
  ): Promise<GoogleDriveGetFoldersInsideFolderResponse> {
    const params = new URLSearchParams({
      q: `mimeType='application/vnd.google-apps.folder' and '${request.folderId}' in parents`,
      fields: "files(id, name)",
      pageSize: "500",
    });
    return this.executeCall(
      "files",
      params
    ) as Promise<GoogleDriveGetFoldersInsideFolderResponse>;
  }

  async getImagesInsideFolder(
    request: GoogleDriveGetImagesInsideFolderRequest
  ): Promise<GoogleDriveGetImagesInsideFolderResponse> {
    const mimeTypeFilter = GoogleDriveImageMimeTypes.map(
      (mimeType) => `mimeType contains '${mimeType}'`
    ).join(" or ");
    const params = new URLSearchParams({
      q: `(${mimeTypeFilter}) and '${request.folderId}' in parents`,
      fields:
        "nextPageToken, files(id, name, trashed, size, modifiedTime, imageMediaMetadata)",
      pageSize: "500",
      ...(request.pageToken !== undefined
        ? { pageToken: request.pageToken }
        : {}),
    });
    return this.executeCall(
      "files",
      params
    ) as Promise<GoogleDriveGetImagesInsideFolderResponse>;
  }

  async getFileById(
    request: GoogleDriveGetFileByIdRequest
  ): Promise<GoogleDriveGetFileByIdResponse> {
    return this.executeCall(
      `files/${request.fileId}`,
      new URLSearchParams({
        fields:
          "id, name, trashed, size, modifiedTime, imageMediaMetadata, parents",
      })
    ) as Promise<GoogleDriveGetFileByIdResponse>;
  }
}
