import { getByID, search } from "@orama/orama";
import { expose } from "comlink";

import { toSearchable } from "@/common/processing";
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
  GoogleDriveDoc,
  GoogleDriveIndex,
  LocalFilesIndex,
  OramaCardDocument,
  OramaIndex,
  SearchResults,
} from "@/common/types";
import { getDefaultSearchSettings } from "@/store/slices/searchSettingsSlice";

import {
  Folder,
  GoogleDriveIndexer,
  Image,
  LocalFilesIndexer,
} from "./indexer";

export class ClientSearchService {
  private localFilesIndex: LocalFilesIndex | undefined;
  private googleDriveIndex: GoogleDriveIndex | undefined;

  constructor() {
    this.localFilesIndex = undefined;
    this.googleDriveIndex = undefined;
  }

  public hasLocalFilesDirectoryHandle(): boolean {
    return this.localFilesIndex?.fileHandle !== undefined;
  }

  public getLocalFilesDirectoryHandle(): FileSystemDirectoryHandle | undefined {
    return this.localFilesIndex?.fileHandle;
  }

  public async setLocalFilesDirectoryHandle(
    directoryHandle: FileSystemDirectoryHandle,
    tags: Array<Tag> | undefined
  ) {
    this.localFilesIndex = {
      fileHandle: directoryHandle,
      index: undefined,
    };
  }

  public async clearLocalFilesIndex() {
    this.localFilesIndex = undefined;
  }

  public async clearGoogleDriveIndex() {
    this.googleDriveIndex = undefined;
  }

  public getLocalFilesIndexSize(): number | undefined {
    return this.localFilesIndex?.index?.size;
  }

  public getGoogleDriveIndexSize(): number | undefined {
    return this.googleDriveIndex?.index?.size;
  }

  public async indexDirectory(
    tags: Array<Tag> | undefined
  ): Promise<{ handle: FileSystemDirectoryHandle; size: number } | undefined> {
    if (this.localFilesIndex?.fileHandle !== undefined) {
      const oramaIndex = await new LocalFilesIndexer().indexFiles(
        [
          new Folder(
            {
              fileHandle: this.localFilesIndex.fileHandle,
              identifier: undefined,
              sourceType: SourceType.LocalFile,
            },
            this.localFilesIndex.fileHandle.name,
            undefined
          ),
        ],
        [],
        tags
      );
      this.localFilesIndex.index = oramaIndex;
      return {
        handle: this.localFilesIndex.fileHandle,
        size: this.localFilesIndex.index.size,
      };
    }
    return undefined;
  }

  public async indexGoogleDrive(
    tags: Array<Tag> | undefined,
    bearerToken: string,
    folders: Array<GoogleDriveDoc>,
    images: Array<GoogleDriveDoc>
  ) {
    // TODO: can we do better than this?
    const mockTopLevelFolder = new Folder(
      {
        sourceType: SourceType.GoogleDrive,
        identifier: "",
        fileHandle: undefined,
      },
      "Google Drive",
      undefined
    );
    const indexer = new GoogleDriveIndexer(bearerToken);
    const oramaIndex = await indexer.indexFiles(
      folders.map(
        ({ id, name }) =>
          new Folder(
            {
              sourceType: SourceType.GoogleDrive,
              identifier: id,
              fileHandle: undefined,
            },
            name,
            undefined
          )
      ),
      (
        await Promise.all(
          images.map(async ({ id }) =>
            indexer.getImageFromIdentifier(id, mockTopLevelFolder)
          )
        )
      ).filter((image) => image !== undefined),
      tags
    );
    this.googleDriveIndex = { index: oramaIndex };
    // TODO: return context about size
  }

  public searchOramaIndex(
    oramaIndex: OramaIndex | undefined,
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number
  ): Array<{ id: string; document: OramaCardDocument }> | undefined {
    if (oramaIndex?.oramaDb === undefined) {
      return undefined;
    }
    const includesTags = searchSettings.filterSettings.includesTags.length > 0;
    const excludesTags = searchSettings.filterSettings.excludesTags.length > 0;
    const hits = search(oramaIndex.oramaDb, {
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

  public search(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number
  ): Array<{ id: string; document: OramaCardDocument }> | undefined {
    return [this.localFilesIndex?.index, this.googleDriveIndex?.index].reduce(
      (
        accumulated: Array<{ id: string; document: OramaCardDocument }>,
        index: OramaIndex | undefined
      ): Array<{ id: string; document: OramaCardDocument }> =>
        index !== undefined
          ? accumulated.concat(
              this.searchOramaIndex(
                index,
                searchSettings,
                query,
                cardTypes,
                limit
              ) ?? []
            )
          : accumulated,
      []
    );
  }

  public retrieveCardIdentifiers(
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

  public editorSearch(
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

        const localResultsForQuery = this.retrieveCardIdentifiers(
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

  public retrieveCardbackIdentifiers(
    searchSettings: SearchSettings
  ): Array<string> | undefined {
    return this.retrieveCardIdentifiers(
      searchSettings.searchTypeSettings.filterCardbacks
        ? searchSettings
        : getDefaultSearchSettings([], false),
      undefined,
      [CardTypeSchema.Cardback]
    );
  }

  public getCardDocuments(identifiersToSearch: Array<string>): CardDocuments {
    return Object.fromEntries(
      identifiersToSearch.reduce(
        (accumulated: Array<[string, CardDocument]>, identifier: string) => {
          const oramaCardDocument = this.getByID(identifier) as
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
    for (const oramaDb of [
      this.localFilesIndex?.index?.oramaDb,
      this.googleDriveIndex?.index?.oramaDb,
    ]) {
      if (oramaDb) {
        const result: OramaCardDocument | undefined = getByID(
          oramaDb,
          identifier
        );
        if (result) {
          return result;
        }
      }
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
    return this.hasLocalFilesDirectoryHandle()
      ? (Object.fromEntries(
          [
            CardTypeSchema.Card,
            CardTypeSchema.Cardback,
            CardTypeSchema.Token,
          ].map((cardType) => [
            cardType,
            this.hasLocalFilesDirectoryHandle()
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

export type ClientSearchServiceWorker = ClientSearchService;
const clientSearchServiceWorker = new ClientSearchService();
expose(clientSearchServiceWorker);
