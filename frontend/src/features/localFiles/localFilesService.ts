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
import { api } from "@/store/api";
import { recalculateSearchResults } from "@/store/listenerMiddleware";
import { useRemoteBackendConfigured } from "@/store/slices/backendSlice";
import { fetchCardDocumentsAndReportError } from "@/store/slices/cardDocumentsSlice";
import { clearSearchResults } from "@/store/slices/searchResultsSlice";
import { getDefaultSearchSettings } from "@/store/slices/searchSettingsSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

const getOramaCardDocument = async (
  fileHandle: FileSystemFileHandle,
  dirHandle: FileSystemDirectoryHandle,
  absoluteParentDirHandle: FileSystemDirectoryHandle
): Promise<OramaCardDocument | null> => {
  const file = await fileHandle.getFile();
  const size = file.size;
  const data = new Uint8Array(await file.arrayBuffer());
  const fileType = filetypemime(data);
  const isImage = fileType.some((mimeType) => mimeType.startsWith("image/"));
  if (isImage) {
    const dimensions = imageSize(data);
    const height = dimensions.height ?? 0;
    const cardType: CardType = dirHandle.name
      .toLowerCase()
      .startsWith("cardback")
      ? CardTypeSchema.Cardback
      : dirHandle.name.toLowerCase().startsWith("token")
      ? CardTypeSchema.Token
      : CardTypeSchema.Card;

    const DPI_HEIGHT_RATIO = 300 / 1110;
    const dpi = 10 * Math.round((height * DPI_HEIGHT_RATIO) / 10);

    const resolved = await absoluteParentDirHandle.resolve(fileHandle);
    const filePath = `./${resolved?.join("/")}`;
    const name = removeFileExtension(file.name);

    const oramaCardDocument: OramaCardDocument = {
      id: filePath,
      cardType: cardType,
      name: name,
      searchq: toSearchable(name),
      source: dirHandle.name,
      dpi: dpi,
      extension: filetypeextension(data)[0],
      size: size,
      fileHandle: fileHandle,
      language: "English",
      tags: [],
      lastModified: new Date(file.lastModified),
    };
    return oramaCardDocument;
  } else {
    return null;
  }
};

async function listAllFilesAndDirs(
  dirHandle: FileSystemDirectoryHandle,
  absoluteParentDirHandle: FileSystemDirectoryHandle
): Promise<Array<OramaCardDocument>> {
  const files: Array<OramaCardDocument> = [];
  for await (const [name, handle] of dirHandle) {
    if (handle instanceof FileSystemDirectoryHandle) {
      files.push(
        ...(await listAllFilesAndDirs(handle, absoluteParentDirHandle))
      );
    } else if (handle instanceof FileSystemFileHandle) {
      const oramaCardDocument = await getOramaCardDocument(
        handle,
        dirHandle,
        absoluteParentDirHandle
      );
      if (oramaCardDocument !== null) {
        files.push(oramaCardDocument);
      }
    }
  }
  return files;
}

const indexDirectory = async (
  handle: FileSystemDirectoryHandle,
  dispatch: AppDispatch,
  tags: Array<Tag> | undefined
): Promise<DirectoryIndex> => {
  const db = create({
    schema: OramaSchema,
  });
  const oramaCardDocuments = await listAllFilesAndDirs(handle, handle);
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
    const excludesTags = searchSettings.filterSettings.includesTags.length > 0;
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
