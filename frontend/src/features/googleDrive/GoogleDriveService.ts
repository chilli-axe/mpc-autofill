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

type DelayFn = (ms: number) => Promise<void>;
const defaultDelay: DelayFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    this.queue.shift()?.();
  }
}

export class GoogleDriveService {
  bearerToken: string;
  private readonly delayFn: DelayFn;
  private readonly semaphore: Semaphore;

  constructor(
    bearerToken: string,
    delayFn: DelayFn = defaultDelay,
    concurrency = 6
  ) {
    this.bearerToken = bearerToken;
    this.delayFn = delayFn;
    this.semaphore = new Semaphore(concurrency);
  }

  async executeCall(resource: string, params: URLSearchParams) {
    const url = `https://www.googleapis.com/drive/v3/${resource}?${params}`;
    const headers = { Authorization: `Bearer ${this.bearerToken}` };
    const MAX_RETRIES = 4;
    let delay = 1000;

    await this.semaphore.acquire();
    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, { headers, method: "GET" });

        if (response.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = response.headers.get("Retry-After");
          await this.delayFn(
            retryAfter != null ? parseInt(retryAfter) * 1000 : delay
          );
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          throw new Error(
            `Google Drive API error: ${response.status} ${response.statusText}`
          );
        }
        return response.json();
      }

      throw new Error("Google Drive API error: 429 Too Many Requests");
    } finally {
      this.semaphore.release();
    }
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
