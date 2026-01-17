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
  LocalDirectoryHandleParams,
  LocalFileHandleParams,
  OramaCardDocument,
  OramaIndex,
  RemoteFileHandleParams,
} from "@/common/types";
import { OramaSchema } from "@/common/types";
import { extractNameAndTags } from "@/features/localFiles/tags";

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
    return this.folder.name.toLowerCase().startsWith("cardback")
      ? CardTypeSchema.Cardback
      : this.folder.name.toLowerCase().startsWith("token")
      ? CardTypeSchema.Token
      : CardTypeSchema.Card;
  }

  async getFullPath(tags: Map<string, Tag>): Promise<Array<string> | null> {
    return [
      ...this.folder.getFullPath(tags),
      this.params.sourceType === SourceType.LocalFile
        ? this.params.fileHandle.name
        : this.params.identifier,
    ];
  }

  async getImageId(tags: Map<string, Tag>): Promise<string> {
    if (this.params.sourceType === SourceType.LocalFile) {
      const resolvedPath = await this.getFullPath(tags);
      // fall back on setting filepath to random string if unable to resolve. realistically this should never happen.
      const filePath = resolvedPath
        ? `./${resolvedPath.slice(1).join("/")}`
        : Math.random().toString();
      return filePath;
    }
    throw new Error("getImageId not implemented yet for other source types");
  }

  async getOramaCardDocument(
    tags: Map<string, Tag>
  ): Promise<OramaCardDocument> {
    const { language, name, tags: extractedTags } = this.unpackName(tags);
    const imageId = await this.getImageId(tags);
    return {
      id: imageId,
      cardType: this.getCardType(),
      name: name,
      searchq: toSearchable(this.name),
      source: this.folder.name, // TODO: verbose naming?
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
    const folders: Array<Folder> = [folder];
    const images: Array<Image> = [];
    while (folders.length > 0) {
      const folder = folders.pop();
      if (folder !== undefined) {
        const imagesInFolder: Array<Image> =
          await this.getAllImagesInsideFolder(folder);
        const subfolders: Array<Folder> = await this.getAllFoldersInsideFolder(
          folder
        );
        images.push(...imagesInFolder);
        folders.push(
          ...subfolders.filter((folder) => !folder.name.startsWith("!"))
        );
      } else {
        break;
      }
    }
    return images;
  }

  public async indexFolder(
    folder: Folder,
    tags: Array<Tag> | undefined
  ): Promise<OramaIndex> {
    const db = create({ schema: OramaSchema });
    const tagsMap = new Map(
      (tags ?? []).map((tag) => [tag.name.toLowerCase(), tag])
    );
    const oramaCardDocuments = await Promise.all(
      (
        await this.exploreFolder(folder)
      ).map((image) => image.getOramaCardDocument(tagsMap))
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
