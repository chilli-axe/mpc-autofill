import { create, insertMultiple, Orama } from "@orama/orama";
import { getByID, search } from "@orama/orama";
import { expose } from "comlink";
import { imageSize } from "image-size";
import { filetypeextension, filetypemime } from "magic-bytes.js";

import {
  extractLanguage,
  removeFileExtension,
  toSearchable,
} from "@/common/processing";
import {
  CardType as CardTypeSchema,
  SearchQuery,
  SearchSettings,
  SourceType,
  Tag,
} from "@/common/schema_types";
import {
  CardDocument,
  CardDocuments,
  CardType,
  DirectoryIndex,
  LocalDirectoryHandleMixin,
  LocalFileHandleMixin,
  OramaCardDocument,
  OramaSchema,
  RemoteFileHandleMixin,
  SearchResults,
} from "@/common/types";
import { extractNameAndTags } from "@/features/localFiles/tags";
import { getDefaultSearchSettings } from "@/store/slices/searchSettingsSlice";

class Folder {
  constructor(
    public readonly params: LocalDirectoryHandleMixin | RemoteFileHandleMixin,
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

class Image {
  constructor(
    public readonly params: LocalFileHandleMixin | RemoteFileHandleMixin,
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
      this.params.fileHandle
        ? this.params.fileHandle.name
        : this.params.identifier,
    ];
  }

  async getOramaCardDocument(
    tags: Map<string, Tag>
  ): Promise<OramaCardDocument> {
    const { language, name, tags: extractedTags } = this.unpackName(tags);
    const resolvedPath = await this.getFullPath(tags);
    // fall back on setting filepath to random string if unable to resolve. realistically this should never happen.
    const filePath = resolvedPath
      ? `./${resolvedPath.join("/")}`
      : Math.random().toString();

    return {
      id: filePath,
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

abstract class Explorer {
  abstract getSourceType(): SourceType;
  abstract getAllFoldersInsideFolder(folder: Folder): Promise<Array<Folder>>;
  abstract getAllImagesInsideFolder(folder: Folder): Promise<Array<Image>>;

  async exploreFolder(folder: Folder): Promise<Array<Image>> {
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
}

class LocalFilesExplorer extends Explorer {
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
      folder.params.fileHandle;
      for await (const [name, handle] of folder.params.fileHandle) {
        if (handle instanceof FileSystemFileHandle) {
          const file = await handle.getFile();
          const data = new Uint8Array(await file.arrayBuffer());

          const fileType = filetypemime(data);
          const isImage = fileType.some((mimeType) =>
            mimeType.startsWith("image/")
          );

          if (isImage) {
            const dimensions = imageSize(data);
            const height = dimensions.height;

            images.push(
              new Image(
                {
                  fileHandle: handle,
                  identifier: undefined,
                  sourceType: folder.params.sourceType,
                },
                removeFileExtension(handle.name),
                filetypeextension(data)[0],
                file.size,
                new Date(file.lastModified),
                height,
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

const indexDirectory = async (
  handle: FileSystemDirectoryHandle,
  tags: Array<Tag> | undefined
): Promise<DirectoryIndex> => {
  const db = create({
    schema: OramaSchema,
  });
  const tagsMap = new Map(
    (tags ?? []).map((tag) => [tag.name.toLowerCase(), tag])
  );
  const oramaCardDocuments = await Promise.all(
    (
      await new LocalFilesExplorer().exploreFolder(
        new Folder(
          {
            fileHandle: handle,
            identifier: undefined,
            sourceType: SourceType.LocalFile,
          },
          handle.name,
          undefined
        )
      )
    ).map((image) => image.getOramaCardDocument(tagsMap))
  );
  insertMultiple(db, oramaCardDocuments);
  const newDirectoryIndex = {
    handle: handle,
    index: {
      oramaDb: db,
      size: oramaCardDocuments.length,
    },
  };
  return newDirectoryIndex;
};

export class LocalFilesService {
  private directoryHandle: FileSystemDirectoryHandle | undefined;
  private directoryIndex: DirectoryIndex | undefined;

  constructor() {
    this.directoryHandle = undefined;
    this.directoryIndex = undefined;
  }

  public hasDirectoryHandle(): boolean {
    return this.directoryHandle !== undefined;
  }

  public getDirectoryHandle(): FileSystemDirectoryHandle | undefined {
    return this.directoryHandle;
  }

  public async setDirectoryHandle(
    directoryHandle: FileSystemDirectoryHandle | undefined,
    tags: Array<Tag> | undefined
  ) {
    this.directoryHandle = directoryHandle;
  }

  public async clearDirectoryHandle() {
    this.directoryHandle = undefined;
  }

  public async indexDirectory(
    tags: Array<Tag> | undefined
  ): Promise<{ handle: FileSystemDirectoryHandle; size: number } | undefined> {
    if (this.directoryHandle !== undefined) {
      const directoryIndex = await indexDirectory(this.directoryHandle, tags);
      this.directoryIndex = directoryIndex;
      return {
        handle: this.directoryHandle,
        size: directoryIndex.index?.size ?? 0,
      };
    }
    return undefined;
  }

  public getDirectoryIndexSize(): number | undefined {
    return this.directoryIndex?.index?.size;
  }

  public search(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number
  ): Array<{ id: string; document: OramaCardDocument }> | undefined {
    if (this.directoryIndex?.index?.oramaDb === undefined) {
      return undefined;
    }
    const includesTags = searchSettings.filterSettings.includesTags.length > 0;
    const excludesTags = searchSettings.filterSettings.excludesTags.length > 0;
    const hits = search(this.directoryIndex?.index?.oramaDb, {
      term: query ? toSearchable(query) : undefined,
      properties: ["searchq"],
      limit: limit ?? 1_000_000, // some arbitrary upper limit. if undefined, orama limits to 10 results.
      exact:
        query !== undefined && !searchSettings.searchTypeSettings.fuzzySearch,
      where: {
        and: [
          { cardType: { in: cardTypes } },
          ...(includesTags
            ? [
                {
                  tags: {
                    containsAny: searchSettings.filterSettings.includesTags,
                  },
                },
              ]
            : []),
          ...(excludesTags
            ? [
                {
                  not: {
                    tags: {
                      containsAny: searchSettings.filterSettings.excludesTags,
                    },
                  },
                },
              ]
            : []),
          {
            dpi: {
              between: [
                searchSettings.filterSettings.minimumDPI,
                searchSettings.filterSettings.maximumDPI,
              ],
            },
          },
          {
            size: {
              lte: searchSettings.filterSettings.maximumSize * 1_000_000,
            },
          },
        ],
      },
      // @ts-ignore // TODO
    }).hits as Array<{ id: string; document: OramaCardDocument }>;
    return hits;
  }

  public searchIdentifiers(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number
  ): Array<string> | undefined {
    const results = this.search(searchSettings, query, cardTypes, limit);
    return results !== undefined
      ? results.map((cardDocument) => cardDocument.id)
      : undefined;
  }

  public searchBig(
    // TODO: rename lmao
    searchSettings: SearchSettings,
    searchQueries: Array<SearchQuery>
  ): SearchResults {
    const localResults: SearchResults = {};
    for (const searchQuery of searchQueries) {
      if (searchQuery.query) {
        if (
          !Object.prototype.hasOwnProperty.call(localResults, searchQuery.query)
        ) {
          localResults[searchQuery.query] = {
            CARD: [],
            CARDBACK: [],
            TOKEN: [],
          };
        }

        const localResultsForQuery = this.searchIdentifiers(
          searchSettings,
          searchQuery.query,
          [searchQuery.cardType]
        );
        if (localResultsForQuery !== undefined) {
          localResults[searchQuery.query][searchQuery.cardType] =
            localResultsForQuery;
        }
      }
    }
    return localResults;
  }

  public searchCardbacks(
    searchSettings: SearchSettings
  ): Array<string> | undefined {
    return this.searchIdentifiers(
      searchSettings.searchTypeSettings.filterCardbacks
        ? searchSettings
        : getDefaultSearchSettings([], false),
      undefined,
      [CardTypeSchema.Cardback]
    );
  }

  public getLocalCardDocuments(
    identifiersToSearch: Array<string>
  ): CardDocuments {
    const oramaDb = this.directoryIndex?.index?.oramaDb;
    if (oramaDb) {
      return Object.fromEntries(
        identifiersToSearch.reduce(
          (accumulated: Array<[string, CardDocument]>, identifier: string) => {
            const oramaCardDocument = getByID(oramaDb, identifier) as
              | OramaCardDocument
              | undefined;
            if (oramaCardDocument !== undefined) {
              accumulated.push([
                oramaCardDocument.id,
                this.translateOramaCardDocumentToCardDocument(
                  oramaCardDocument
                ),
              ]);
            }
            return accumulated;
          },
          [] as Array<[string, CardDocument]>
        )
      );
    } else {
      return {};
    }
  }

  public getByID(identifier: string): OramaCardDocument | undefined {
    if (this.directoryIndex?.index?.oramaDb) {
      return getByID(this.directoryIndex.index.oramaDb, identifier) as
        | OramaCardDocument
        | undefined;
    }
    return undefined;
  }

  public translateOramaCardDocumentToCardDocument(
    oramaCardDocument: OramaCardDocument
  ): CardDocument {
    const lastModified = oramaCardDocument.lastModified.toLocaleDateString(
      undefined,
      {
        weekday: undefined,
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
    return {
      identifier: oramaCardDocument.id,
      cardType: oramaCardDocument.cardType,
      name: oramaCardDocument.name,
      priority: 0,
      source: oramaCardDocument.source,
      sourceName: oramaCardDocument.source,
      sourceId: 0,
      sourceVerbose: oramaCardDocument.source,
      sourceType: oramaCardDocument.params.sourceType,
      sourceExternalLink: undefined,
      dpi: oramaCardDocument.dpi,
      searchq: oramaCardDocument.searchq,
      extension: oramaCardDocument.extension,
      dateCreated: lastModified,
      dateModified: lastModified,
      size: oramaCardDocument.size,
      smallThumbnailUrl: undefined,
      mediumThumbnailUrl: undefined,
      language: "EN", // TODO
      tags: oramaCardDocument.tags,
    };
  }

  public getSampleCards():
    | { [cardType in CardType]: Array<CardDocument> }
    | undefined {
    return this.hasDirectoryHandle()
      ? (Object.fromEntries(
          [
            CardTypeSchema.Card,
            CardTypeSchema.Cardback,
            CardTypeSchema.Token,
          ].map((cardType) => [
            cardType,
            this.hasDirectoryHandle()
              ? this.search(
                  getDefaultSearchSettings([], false),
                  undefined,
                  [cardType],
                  cardType === CardTypeSchema.Card ? 4 : 1
                )?.map((result) =>
                  this.translateOramaCardDocumentToCardDocument(result.document)
                )
              : [],
          ])
        ) as { [cardType in CardType]: Array<CardDocument> })
      : undefined;
  }
}

export type LocalFilesServiceWorker = LocalFilesService;
const localFilesServiceWorker = new LocalFilesService();
expose(localFilesServiceWorker);
