import { create, insertMultiple } from "@orama/orama";
import { imageDimensionsFromStream } from "image-dimensions";

import { removeFileExtension } from "@/common/processing";
import { SourceType, Tag } from "@/common/schema_types";
import {
  GoogleDriveFile,
  GoogleDriveImageMimeTypes,
  OramaIndex,
} from "@/common/types";
import { OramaSchema } from "@/common/types";
import { Folder } from "@/features/clientSearch/Folder";
import { Image } from "@/features/clientSearch/Image";

import { GoogleDriveService } from "../googleDrive/GoogleDriveService";

abstract class Indexer {
  abstract getSourceType(): SourceType;
  abstract getAllFoldersInsideFolder(folder: Folder): Promise<Array<Folder>>;
  abstract getAllImagesInsideFolder(folder: Folder): Promise<Array<Image>>;

  private async exploreFolder(folder: Folder): Promise<Array<Image>> {
    const [imagesInFolder, subfolders] = await Promise.all([
      this.getAllImagesInsideFolder(folder),
      this.getAllFoldersInsideFolder(folder),
    ]);

    const validSubfolders = subfolders.filter(
      (subfolder) => !subfolder.name.startsWith("!")
    );

    const imagesFromSubfolders = await Promise.all(
      validSubfolders.map((subfolder) => this.exploreFolder(subfolder))
    );

    return [...imagesInFolder, ...imagesFromSubfolders.flat()];
  }

  public async indexFiles(
    folders: Array<Folder>,
    images: Array<Image>,
    tags: Array<Tag> | undefined
  ): Promise<{ oramaIndex: OramaIndex; images: Array<Image> }> {
    const db = create({
      schema: OramaSchema,
      sort: {
        enabled: true,
        unsortableProperties: [
          // every field on OramaCardDocument except `searchq` and `lastModifiedNumber` :)
          "name",
          "source",
          "sourceId",
          "sourceVerbose",
          "cardType",
          "extension",
          "language",
          "tags",
          "dpi",
          "size",
          "id",
          "lastModified",
          "params",
        ],
      },
    });
    const tagsMap = new Map(
      (tags ?? []).map((tag) => [tag.name.toLowerCase(), tag])
    );
    const allImages = (
      await Promise.all(folders.map((folder) => this.exploreFolder(folder)))
    )
      .concat([images])
      .flat();

    const seenIds = new Set<string>();
    const uniqueImages = allImages.filter((image) => {
      const id = image.getImageId(tagsMap);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    const deduplicatedOramaCardDocuments = uniqueImages.map((image) =>
      image.getOramaCardDocument(tagsMap)
    );
    insertMultiple(db, deduplicatedOramaCardDocuments);
    return {
      oramaIndex: {
        oramaDb: db,
        size: deduplicatedOramaCardDocuments.length,
      },
      images: uniqueImages,
    };
  }
}

export class LocalFilesIndexer extends Indexer {
  getSourceType(): SourceType.LocalFile {
    return SourceType.LocalFile;
  }

  async getAllFoldersInsideFolder(folder: Folder): Promise<Array<Folder>> {
    const folders: Array<Folder> = [];
    if (folder.params.sourceType === this.getSourceType()) {
      for await (const [name, handle] of folder.params.fileHandle) {
        if (handle instanceof FileSystemDirectoryHandle) {
          folders.push(
            new Folder(
              {
                fileHandle: handle,
                identifier: undefined,
                sourceType: folder.params.sourceType,
              },
              handle.name,
              folder
            )
          );
        }
      }
    }
    return folders;
  }

  async getAllImagesInsideFolder(folder: Folder): Promise<Array<Image>> {
    const images: Array<Image> = [];
    if (folder.params.sourceType === this.getSourceType()) {
      for await (const [name, handle] of folder.params.fileHandle) {
        if (handle instanceof FileSystemFileHandle) {
          const file = await handle.getFile();
          const dimensions = await imageDimensionsFromStream(file.stream());
          if (dimensions !== undefined) {
            images.push(
              new Image(
                {
                  fileHandle: handle,
                  identifier: undefined,
                  sourceType: folder.params.sourceType,
                },
                removeFileExtension(handle.name),
                dimensions.type,
                file.size,
                new Date(file.lastModified),
                dimensions.height,
                folder
              )
            );
          }
        }
      }
    }
    return images;
  }
}

export class GoogleDriveIndexer extends Indexer {
  googleDriveService: GoogleDriveService;

  constructor(bearerToken: string) {
    super();
    this.googleDriveService = new GoogleDriveService(bearerToken);
  }

  getSourceType(): SourceType.GoogleDrive {
    return SourceType.GoogleDrive;
  }

  createImage(
    folder: Folder,
    file: Pick<
      GoogleDriveFile,
      "id" | "name" | "size" | "modifiedTime" | "imageMediaMetadata"
    >
  ): Image {
    const nameParts = file.name.split(".");
    const extension =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    return new Image(
      {
        sourceType: this.getSourceType(),
        identifier: file.id,
        fileHandle: undefined,
      },
      removeFileExtension(file.name),
      extension,
      parseInt(file.size),
      new Date(file.modifiedTime),
      // TODO: createdTime!
      file.imageMediaMetadata?.height ?? 0,
      folder
    );
  }

  async getAllFoldersInsideFolder(folder: Folder): Promise<Array<Folder>> {
    if (folder.params.sourceType !== this.getSourceType()) {
      return [];
    }
    const response = await this.googleDriveService.getFoldersInsideFolder({
      folderId: folder.params.identifier,
    });
    return response.files.map(
      (file: { id: string; name: string }) =>
        new Folder(
          {
            sourceType: this.getSourceType(),
            identifier: file.id,
            fileHandle: undefined,
          },
          file.name,
          folder
        )
    );
  }

  async getAllImagesInsideFolder(folder: Folder): Promise<Array<Image>> {
    if (folder.params.sourceType !== this.getSourceType()) {
      return [];
    }
    const folderId = folder.params.identifier;
    const images: Array<Image> = [];
    let pageToken: string | undefined = undefined;
    const mimeTypeFilter = GoogleDriveImageMimeTypes.map(
      (mimeType) => `mimeType contains '${mimeType}'`
    ).join(" or ");
    while (true) {
      const response = await this.googleDriveService.getImagesInsideFolder({
        folderId,
        pageToken,
      });
      const newImages = response.files
        .filter((file) => !file.trashed)
        .map((file) => this.createImage(folder, file));
      images.push(...newImages);
      pageToken = response.nextPageToken;
      if (
        pageToken == null ||
        response.files === undefined ||
        response.files.length === 0
      ) {
        break;
      }
    }
    return images;
  }

  async getImageFromIdentifier(
    identifier: string,
    folder: Folder | undefined
  ): Promise<Image | undefined> {
    const file = await this.googleDriveService.getFileById({
      fileId: identifier,
    });
    if (file.trashed) return undefined;
    if (folder !== undefined) {
      return this.createImage(folder, file);
    } else {
      // construct folder by looking up parent name
      const parentFile = await this.googleDriveService.getFileById({
        fileId: file.parents[0]!,
      });
      return this.createImage(
        new Folder(
          {
            sourceType: SourceType.GoogleDrive,
            identifier: parentFile.id,
            fileHandle: undefined,
          },
          parentFile.name,
          undefined
        ),
        file
      );
    }
  }
}
