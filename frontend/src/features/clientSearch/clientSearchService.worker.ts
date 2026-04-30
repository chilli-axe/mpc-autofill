import { create, getByID, insertMultiple, search } from "@orama/orama";
import { expose } from "comlink";

import { Printing, Unknown } from "@/common/constants";
import { toSearchable } from "@/common/processing";
import {
  CardType as CardTypeSchema,
  SearchQuery,
  SearchSettings,
  SortBy,
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
  OramaSchema,
  OramaSearchResult,
  OramaSearchResults,
  SearchResults,
} from "@/common/types";
import { parseDjangoDate } from "@/common/utils";
import { getDefaultSearchSettings } from "@/store/slices/searchSettingsSlice";

import { Folder, GoogleDriveIndexer, LocalFilesIndexer } from "./indexer";

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

  public hasGoogleDriveIndex() {
    return this.googleDriveIndex !== undefined;
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
            indexer.getImageFromIdentifier(id, undefined)
          )
        )
      ).filter((image) => image !== undefined),
      tags
    );
    this.googleDriveIndex = { index: oramaIndex };
    return {
      size: this.googleDriveIndex.index?.size,
    };
  }

  private searchOramaIndex(
    oramaIndex: OramaIndex | undefined,
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    sortBy?: SortBy,
    limit?: number,
    offset?: number,
    printings?: Array<Printing>,
    artists?: Array<string>
  ): OramaSearchResults | undefined {
    if (oramaIndex?.oramaDb === undefined) {
      return undefined;
    }

    const includesTags = searchSettings.filterSettings.includesTags.length > 0;
    const excludesTags = searchSettings.filterSettings.excludesTags.length > 0;

    const sortByConfigs = {
      [SortBy.DateCreatedAscending]: {
        property: "createdNumber",
        order: "ASC",
      },
      [SortBy.DateCreatedDescending]: {
        property: "createdNumber",
        order: "DESC",
      },
      [SortBy.DateModifiedAscending]: {
        property: "lastModifiedNumber",
        order: "ASC",
      },
      [SortBy.DateModifiedDescending]: {
        property: "lastModifiedNumber",
        order: "DESC",
      },
      [SortBy.NameAscending]: { property: "searchq", order: "ASC" },
      [SortBy.NameDescending]: { property: "searchq", order: "DESC" },
    } as const;
    const sortByConfig = sortBy && sortByConfigs[sortBy];

    const searchResults = search(oramaIndex.oramaDb, {
      term: query ? toSearchable(query) : undefined,
      properties: ["searchq"],
      limit: limit ?? 1_000_000, // some arbitrary upper limit. if undefined, orama limits to 10 results.
      offset: offset ?? 0,
      exact:
        query !== undefined && !searchSettings.searchTypeSettings.fuzzySearch,
      where: {
        and: [
          ...(cardTypes.length > 0 ? [{ cardType: { in: cardTypes } }] : []),
          {
            or: [
              ...searchSettings.sourceSettings.sources
                .filter((sourceRow) => sourceRow[1] === true)
                .map((sourceRow) => ({ sourceId: { eq: sourceRow[0] } })),
              { sourceId: { eq: -1 } },
            ],
          },
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
          ...((printings?.length ?? 0) > 0
            ? [
                {
                  or: printings!.map(({ expansionCode, collectorNumber }) => ({
                    expansionCode: expansionCode,
                    collectorNumber: collectorNumber,
                  })),
                },
              ]
            : []),
          ...((artists?.length ?? 0) > 0 ? [{ artist: { in: artists } }] : []),
        ],
      },
      sortBy: sortByConfig,
    }) as {
      hits: Array<OramaSearchResult> | undefined;
      count: number | undefined;
    };
    return { hits: searchResults.hits ?? [], count: searchResults.count ?? 0 };
  }

  private search(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    sortBy?: SortBy,
    limit?: number,
    offset?: number
  ): OramaSearchResults | undefined {
    return [this.localFilesIndex?.index, this.googleDriveIndex?.index].reduce(
      (
        accumulated: OramaSearchResults,
        index: OramaIndex | undefined
      ): OramaSearchResults => {
        if (index === undefined) {
          return accumulated;
        }
        const searchResults = this.searchOramaIndex(
          index,
          searchSettings,
          query,
          cardTypes,
          sortBy,
          limit,
          offset
        );
        return {
          hits: accumulated.hits.concat(searchResults?.hits ?? []),
          count: accumulated.count + (searchResults?.count ?? 0),
        };
      },
      { hits: [], count: 0 }
    );
  }

  public async filterGridSelectorIdentifiers(
    cards: Array<CardDocument>,
    searchSettings: SearchSettings,
    sortBy: SortBy | undefined,
    artists: Array<string>,
    printings: Array<Printing>
  ): Promise<Array<string>> {
    const oramaDb = await create({
      schema: OramaSchema,
      sort: {
        enabled: true,
        unsortableProperties: [
          "id",
          "name",
          "cardType",
          "extension",
          "language",
          "tags",
          "dpi",
          "size",
        ],
      },
    });
    await insertMultiple(
      oramaDb,
      cards.map(
        (card): OramaCardDocument => ({
          id: card.identifier,
          cardType: card.cardType,
          name: card.name,
          searchq: card.searchq,
          source: card.source,
          sourceId: card.sourceId,
          sourceVerbose: card.sourceVerbose,
          dpi: card.dpi,
          extension: card.extension,
          size: card.size,
          language: card.language,
          tags: card.tags,
          lastModified: parseDjangoDate(card.dateModified),
          lastModifiedNumber: parseDjangoDate(card.dateModified).valueOf(),
          created: parseDjangoDate(card.dateCreated),
          createdNumber: parseDjangoDate(card.dateCreated).valueOf(),
          params: {
            identifier: card.identifier,
            sourceType: SourceType.GoogleDrive,
            fileHandle: undefined,
          },
          expansionCode: card.canonicalCard?.expansionCode ?? Unknown,
          collectorNumber: card.canonicalCard?.collectorNumber ?? Unknown,
          artist: card.canonicalArtist?.name ?? Unknown,
        })
      )
    );
    const oramaIndex: OramaIndex = { oramaDb, size: cards.length };

    const results = this.searchOramaIndex(
      oramaIndex,
      searchSettings,
      undefined,
      [],
      sortBy,
      undefined,
      undefined,
      printings,
      artists
    );
    if (sortBy !== undefined) {
      return results?.hits.map((hit) => hit.id) ?? [];
    } else {
      // honour the ordering of `cards`
      const resultsSet = new Set(results?.hits.map((hit) => hit.id));
      return cards
        .map((card) => card.identifier)
        .filter((identifier) => resultsSet.has(identifier));
    }
  }

  public retrieveCardIdentifiers(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number,
    offset?: number
  ): Array<string> | undefined {
    const results = this.search(
      searchSettings,
      query,
      cardTypes,
      undefined,
      limit,
      offset
    );
    return results !== undefined
      ? results.hits.map((cardDocument) => cardDocument.id)
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

  public exploreSearch(
    sortBy: SortBy | undefined,
    query: string | undefined,
    cardTypes: Array<CardType>,
    searchSettings: SearchSettings,
    pageStart: number,
    pageSize: number
  ): { cards: Array<CardDocument>; count: number } {
    const searchResults = this.search(
      searchSettings,
      query,
      cardTypes,
      sortBy,
      pageSize,
      pageStart
    );
    const cardIds = searchResults?.hits?.map(({ id }) => id) ?? [];
    const cards = this.getCardDocumentsArray(cardIds);
    return {
      cards: cards,
      count: searchResults?.count ?? 0,
    };
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

  private getCardDocument(identifier: string): CardDocument | undefined {
    const oramaCardDocument = this.getByID(identifier);
    return oramaCardDocument
      ? this.translateOramaCardDocumentToCardDocument(oramaCardDocument)
      : undefined;
  }

  private getCardDocumentsArray(
    identifiersToSearch: Array<string>
  ): Array<CardDocument> {
    return identifiersToSearch.reduce(
      (accumulated: Array<CardDocument>, identifier: string) => {
        const cardDocument = this.getCardDocument(identifier);
        if (cardDocument !== undefined) {
          accumulated.push(cardDocument);
        }
        return accumulated;
      },
      [] as Array<CardDocument>
    );
  }

  public getCardDocuments(identifiersToSearch: Array<string>): CardDocuments {
    return Object.fromEntries(
      identifiersToSearch.reduce(
        (accumulated: Array<[string, CardDocument]>, identifier: string) => {
          const cardDocument = this.getCardDocument(identifier);
          if (cardDocument !== undefined) {
            accumulated.push([cardDocument.identifier, cardDocument]);
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
      sourceId: -1,
      sourceVerbose: oramaCardDocument.sourceVerbose,
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
                  undefined,
                  cardType === CardTypeSchema.Card ? 4 : 1
                )?.hits?.map((result) =>
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
