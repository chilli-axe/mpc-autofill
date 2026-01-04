import { create, insertMultiple, Orama } from "@orama/orama";
import { getByID, search } from "@orama/orama";
import { imageSize } from "image-size";
import { filetypeextension, filetypemime } from "magic-bytes.js";
import { DispatchWithoutAction } from "react";

import { QueryTags } from "@/common/constants";
import { removeFileExtension, toSearchable } from "@/common/processing";
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
  OramaCardDocument,
  OramaSchema,
  SearchResults,
} from "@/common/types";
import { extractNameAndTags } from "@/features/localFiles/tags";
import { api } from "@/store/api";
import { recalculateSearchResults } from "@/store/listenerMiddleware";
import { fetchCardDocumentsAndReportError } from "@/store/slices/cardDocumentsSlice";
import { clearSearchResults } from "@/store/slices/searchResultsSlice";
import { getDefaultSearchSettings } from "@/store/slices/searchSettingsSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

const extractLanguage = (name: string): [string | undefined, string] => {
  const languageRegex = /^(?:\{(.+)\} )?(.*?)$/g;
  const results = [...name.matchAll(languageRegex)][0];
  const languageCode: string | undefined = results[1]; // TODO: match against valid language codes here
  const remainderOfName = results[2];
  return [languageCode, remainderOfName];
};

class Folder {
  handle: FileSystemDirectoryHandle;
  name: string;
  parent: Folder | undefined;

  constructor(
    handle: FileSystemDirectoryHandle,
    name: string,
    parent: Folder | undefined
  ) {
    this.handle = handle;
    this.name = name;
    this.parent = parent;
  }

  getAbsoluteParent(): FileSystemDirectoryHandle {
    if (this.parent === undefined) {
      return this.handle;
    }
    return this.parent.getAbsoluteParent();
  }

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
}

class Image {
  handle: FileSystemFileHandle;
  name: string;
  extension: string;
  size: number;
  modifiedTime: Date;
  height: number;
  folder: Folder;

  constructor(
    handle: FileSystemFileHandle,
    name: string,
    extension: string,
    size: number,
    modifiedTime: Date,
    height: number,
    folder: Folder
  ) {
    this.handle = handle;
    this.name = name;
    this.extension = extension;
    this.size = size;
    this.modifiedTime = modifiedTime;
    this.height = height;
    this.folder = folder;
  }

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
    return this.folder.handle.name.toLowerCase().startsWith("cardback")
      ? CardTypeSchema.Cardback
      : this.folder.handle.name.toLowerCase().startsWith("token")
      ? CardTypeSchema.Token
      : CardTypeSchema.Card;
  }

  async getResolvedPath(): Promise<Array<string> | null> {
    return await this.folder.getAbsoluteParent().resolve(this.handle);
  }

  async getOramaCardDocument(
    tags: Map<string, Tag>
  ): Promise<OramaCardDocument> {
    const { language, name, tags: extractedTags } = this.unpackName(tags);
    const resolvedPath = await this.getResolvedPath();
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
      fileHandle: this.handle,
      language: language ?? "English", // TODO: data type
      tags: Array.from(extractedTags),
      lastModified: this.modifiedTime,
    };
  }
}

const getAllImagesInFolder = async (folder: Folder): Promise<Array<Image>> => {
  const images: Array<Image> = [];
  for await (const [name, handle] of folder.handle) {
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
            handle,
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
  return images;
};
const getAllFoldersInFolder = async (
  folder: Folder
): Promise<Array<Folder>> => {
  const folders: Array<Folder> = [];
  for await (const [name, handle] of folder.handle) {
    if (handle instanceof FileSystemDirectoryHandle) {
      folders.push(new Folder(handle, handle.name, folder));
    }
  }
  return folders;
};

const exploreFolder = async (
  absoluteParentDirHandle: FileSystemDirectoryHandle
): Promise<Array<Image>> => {
  const folders: Array<Folder> = [
    new Folder(
      absoluteParentDirHandle,
      absoluteParentDirHandle.name,
      undefined
    ),
  ];
  const images: Array<Image> = [];
  while (folders.length > 0) {
    const folder = folders.pop();
    if (folder !== undefined) {
      const imagesInFolder: Array<Image> = await getAllImagesInFolder(folder);
      const subfolders: Array<Folder> = await getAllFoldersInFolder(folder);
      images.push(...imagesInFolder);
      folders.push(
        ...subfolders.filter((folder) => !folder.name.startsWith("!"))
      );
    } else {
      break;
    }
  }
  return images;
};

const indexDirectory = async (
  handle: FileSystemDirectoryHandle,
  dispatch: AppDispatch,
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
      await exploreFolder(handle)
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
  dispatch(
    setNotification([
      Math.random().toString(),
      {
        name: `Synchronised ${handle.name}`,
        message: `Indexed ${oramaCardDocuments.length} cards.`,
        level: "info",
      },
    ])
  );
  // @ts-ignore // TODO: fix properly.
  return newDirectoryIndex; // @ts-ignore TODO: can we serialise/deserialise our index as it's needed to improve performance?
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
    state: RootState,
    dispatch: AppDispatch,
    forceUpdate: DispatchWithoutAction,
    tags: Array<Tag> | undefined
  ) {
    this.directoryHandle = directoryHandle;
    await this.indexDirectory(dispatch, forceUpdate, tags);
    await recalculateSearchResults(state, dispatch, true);
  }

  public async clearDirectoryHandle(state: RootState, dispatch: AppDispatch) {
    this.directoryHandle = undefined;
    await recalculateSearchResults(state, dispatch, true);
  }

  public async indexDirectory(
    dispatch: AppDispatch,
    forceUpdate: DispatchWithoutAction,
    tags: Array<Tag> | undefined
  ) {
    if (this.directoryHandle !== undefined) {
      this.directoryIndex = await indexDirectory(
        this.directoryHandle,
        dispatch,
        tags
      );
      dispatch(api.util.invalidateTags([QueryTags.BackendSpecific]));
      dispatch(clearSearchResults());
      fetchCardDocumentsAndReportError(dispatch, { refreshCardbacks: true });
      forceUpdate();
    }
  }

  public getDirectoryIndex(): DirectoryIndex | undefined {
    return this.directoryIndex;
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
      term: query,
      properties: ["searchq"],
      limit: limit ?? 1_000_000, // some arbitrary upper limit. if undefined, orama limits to 10 results.
      exact:
        query !== undefined && !searchSettings.searchTypeSettings.fuzzySearch,
      where: {
        cardType: {
          in: cardTypes,
        },
        ...(includesTags
          ? {
              tags: {
                containsAny: searchSettings.filterSettings.includesTags,
                ...(excludesTags
                  ? {
                      not: {
                        containsAny: searchSettings.filterSettings.excludesTags,
                      },
                    }
                  : {}),
              },
            }
          : {}),
        dpi: {
          between: [
            searchSettings.filterSettings.minimumDPI,
            searchSettings.filterSettings.maximumDPI,
          ],
        },
        size: {
          lte: searchSettings.filterSettings.maximumSize * 1_000_000,
        },
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

        const localResultsForQuery = localFilesService.searchIdentifiers(
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
    // TODO: what about cardbacks not filtered?
    return this.searchIdentifiers(searchSettings, undefined, [
      CardTypeSchema.Cardback,
    ]);
  }

  public getLocalCardDocuments(
    oramaDb: Orama<typeof OramaSchema>,
    identifiersToSearch: Array<string>
  ): CardDocuments {
    return Object.fromEntries(
      identifiersToSearch.reduce(
        (accumulated: Array<[string, CardDocument]>, identifier: string) => {
          const oramaCardDocument = getByID(oramaDb, identifier) as
            | OramaCardDocument
            | undefined;
          if (oramaCardDocument !== undefined) {
            accumulated.push([
              oramaCardDocument.id,
              this.translateOramaCardDocumentToCardDocument(oramaCardDocument),
            ]);
          }
          return accumulated;
        },
        [] as Array<[string, CardDocument]>
      )
    );
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
      sourceType: SourceType.LocalFile,
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
            localFilesService.hasDirectoryHandle()
              ? localFilesService
                  .search(
                    getDefaultSearchSettings([], false),
                    undefined,
                    [cardType],
                    cardType === CardTypeSchema.Card ? 4 : 1
                  )
                  ?.map((result) =>
                    this.translateOramaCardDocumentToCardDocument(
                      result.document
                    )
                  )
              : [],
          ])
        ) as { [cardType in CardType]: Array<CardDocument> })
      : undefined;
  }
}

export const localFilesService = new LocalFilesService();
