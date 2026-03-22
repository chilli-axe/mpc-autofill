import { create, insertMultiple } from "@orama/orama";
import { imageDimensionsFromStream, ImageType } from "image-dimensions";

import {
  extractLanguage,
  removeFileExtension,
  toSearchable,
} from "@/common/processing";
import {
  CardType as CardTypeSchema,
  SourceType,
  Tag,
} from "@/common/schema_types";
import {
  CardType,
  GoogleDriveFile,
  GoogleDriveImageMimeTypes,
  LocalDirectoryHandleParams,
  LocalFileHandleParams,
  OramaCardDocument,
  OramaIndex,
  RemoteFileHandleParams,
} from "@/common/types";
import { OramaSchema } from "@/common/types";
import { extractNameAndTags } from "@/features/clientSearch/tags";

import { GoogleDriveService } from "../googleDrive/GoogleDriveService";

export class Folder {
  constructor(
    public readonly params: LocalDirectoryHandleParams | RemoteFileHandleParams,
    public readonly name: string,
    public readonly parent: Folder | undefined
  ) {}

  unpackName(tags: Map<string, Tag>): {
    language: string | undefined;
    name: string;
    tags: Set<string>;
  } {
    const [language, name] = extractLanguage(this.name);
    const [nameWithNoTags, extractedTags] = extractNameAndTags(name, tags);
    return {
      language,
      name: nameWithNoTags,
      tags: extractedTags,
    };
  }

  getLanguage(tags: Map<string, Tag>): string | undefined {
    const { language } = this.unpackName(tags);
    if (this.parent === undefined) {
      return language;
    }
    return language ?? this.parent.getLanguage(tags);
  }

  getTags(tags: Map<string, Tag>): Set<string> {
    const { tags: extractedTags } = this.unpackName(tags);
    if (this.parent === undefined) {
      return extractedTags;
    }
    return extractedTags.union(this.parent.getTags(tags));
  }

  getFullPath(tags: Map<string, Tag>): Array<string> {
    const { name } = this.unpackName(tags);
    if (this.parent === undefined) {
      return [name];
    }
    return [...this.parent.getFullPath(tags), name];
  }
}

export class Image {
  constructor(
    public readonly params: LocalFileHandleParams | RemoteFileHandleParams,
    public readonly name: string,
    public readonly extension: string,
    public readonly size: number,
    public readonly modifiedTime: Date,
    public readonly height: number,
    public readonly folder: Folder
  ) {}

  unpackName(tags: Map<string, Tag>): {
    language: string | undefined;
    name: string;
    tags: Set<string>;
  } {
    const [language, name] = extractLanguage(this.name);
    const [nameWithNoTags, extractedTags] = extractNameAndTags(name, tags);
    return {
      language: language ?? this.folder.getLanguage(tags),
      name: nameWithNoTags,
      tags: extractedTags.union(this.folder.getTags(tags)),
    };
  }

  getCardType(): CardType {
    return this.folder.name.toLowerCase().includes("cardback")
      ? CardTypeSchema.Cardback
      : this.folder.name.toLowerCase().includes("token")
      ? CardTypeSchema.Token
      : CardTypeSchema.Card;
  }

  getFullPath(tags: Map<string, Tag>): Array<string> | null {
    return [
      ...this.folder.getFullPath(tags),
      this.params.sourceType === SourceType.LocalFile
        ? this.params.fileHandle.name
        : this.params.identifier,
    ];
  }

  getImageId(tags: Map<string, Tag>): string {
    if (this.params.sourceType === SourceType.LocalFile) {
      const resolvedPath = this.getFullPath(tags);
      // fall back on setting filepath to random string if unable to resolve. realistically this should never happen.
      const filePath = resolvedPath
        ? `./${resolvedPath.slice(1).join("/")}`
        : Math.random().toString();
      return filePath;
    }
    if (this.params.sourceType === SourceType.GoogleDrive) {
      return this.params.identifier;
    }
    throw new Error("getImageId not implemented yet for other source types");
  }

  getOramaCardDocument(tags: Map<string, Tag>): OramaCardDocument {
    const { language, name, tags: extractedTags } = this.unpackName(tags);
    const imageId = this.getImageId(tags);
    return {
      id: imageId,
      cardType: this.getCardType(),
      name: name,
      searchq: toSearchable(this.name),
      source: this.folder.name, // TODO: verbose naming?
      sourceVerbose: this.folder.getFullPath(tags).join(" / "),
      dpi: 10 * Math.round((this.height * 300) / 1110 / 10), // TODO: NaN?
      extension: this.extension,
      size: this.size,
      params: this.params,
      language: language ?? "English", // TODO: data type
      tags: Array.from(extractedTags),
      lastModified: this.modifiedTime,
    };
  }
}

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
  ): Promise<OramaIndex> {
    const db = create({ schema: OramaSchema });
    const tagsMap = new Map(
      (tags ?? []).map((tag) => [tag.name.toLowerCase(), tag])
    );
    const oramaCardDocuments = await Promise.all(
      folders.map(async (folder) => this.exploreFolder(folder))
    )
      .then((images2d) => images2d.concat([images]))
      .then((images2d) =>
        images2d.flatMap((images) =>
          images.map((image) => image.getOramaCardDocument(tagsMap))
        )
      );
    insertMultiple(db, oramaCardDocuments);
    return {
      oramaDb: db,
      size: oramaCardDocuments.length,
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
