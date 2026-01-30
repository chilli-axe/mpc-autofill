import { Remote, wrap } from "comlink";
import { DispatchWithoutAction } from "react";

import { QueryTags } from "@/common/constants";
import { SearchQuery, SearchSettings, Tag } from "@/common/schema_types";
import {
  CardDocument,
  CardDocuments,
  CardType,
  OramaCardDocument,
  SearchResults,
} from "@/common/types";
import { api } from "@/store/api";
import { recalculateSearchResults } from "@/store/listenerMiddleware";
import { fetchCardDocumentsAndReportError } from "@/store/slices/cardDocumentsSlice";
import { clearSearchResults } from "@/store/slices/searchResultsSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

import { ClientSearchServiceWorker } from "./clientSearchService.worker";

/**
 * work around next.js limitation where workers cannot be initialised at the module level
 * because of SSR hydration
 */
export class ClientSearchService {
  worker: Remote<ClientSearchServiceWorker> | undefined;
  constructor() {
    this.worker = undefined;
  }

  public initialiseWorker() {
    const worker = new Worker(
      new URL("./clientSearchService.worker.ts", import.meta.url),
      {
        type: "module",
      }
    );
    this.worker = wrap<ClientSearchServiceWorker>(worker);
  }

  public async hasLocalFilesDirectoryHandle(): Promise<boolean> {
    return this.worker?.hasLocalFilesDirectoryHandle() ?? false;
  }

  public async getLocalFilesDirectoryHandle(): Promise<
    FileSystemDirectoryHandle | undefined
  > {
    return this.worker?.getLocalFilesDirectoryHandle();
  }

  public async setDirectoryHandle(
    directoryHandle: FileSystemDirectoryHandle,
    state: RootState,
    dispatch: AppDispatch,
    forceUpdate: DispatchWithoutAction,
    tags: Array<Tag> | undefined
  ) {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    await this.worker.setLocalFilesDirectoryHandle(directoryHandle, tags);
    await this.indexDirectory(dispatch, forceUpdate, tags);
    await recalculateSearchResults(state, dispatch, true);
  }

  // directory handle stuff below

  public async clearDirectoryHandle(state: RootState, dispatch: AppDispatch) {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker
      .clearLocalFilesIndex()
      .then(() => recalculateSearchResults(state, dispatch, true));
  }

  public async indexDirectory(
    dispatch: AppDispatch,
    forceUpdate: DispatchWithoutAction,
    tags: Array<Tag> | undefined
  ) {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    const notificationId = Math.random().toString();
    if (await this.worker.hasLocalFilesDirectoryHandle()) {
      dispatch(
        setNotification([
          notificationId,
          {
            name: `Synchronising ${
              (await this.worker.getLocalFilesDirectoryHandle())!.name
            }`,
            message: "This may take a while...",
            level: "info",
          },
        ])
      );
    }
    const indexDirectoryResult = await this.worker.indexDirectory(tags);
    if (indexDirectoryResult !== undefined) {
      const { handle, size } = indexDirectoryResult;
      dispatch(
        setNotification([
          notificationId, // overwrite the name/message for the existing toast rather than making a new one
          {
            name: `Synchronised ${handle.name}`,
            message: `Indexed ${size} cards.`,
            level: "info",
          },
        ])
      );
      dispatch(api.util.invalidateTags([QueryTags.BackendSpecific]));
      dispatch(clearSearchResults());
      fetchCardDocumentsAndReportError(dispatch, { refreshCardbacks: true });
      forceUpdate();
    }
  }

  public async getDirectoryIndexSize(): Promise<number | undefined> {
    return this.worker?.getLocalFilesIndexSize();
  }

  // search stuff below

  public async search(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number
  ): Promise<Array<{ id: string; document: OramaCardDocument }> | undefined> {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker.search(searchSettings, query, cardTypes, limit);
  }

  public async retrieveCardIdentifiers(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number
  ): Promise<Array<string> | undefined> {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker.retrieveCardIdentifiers(
      searchSettings,
      query,
      cardTypes,
      limit
    );
  }
  public async editorSearch(
    // TODO: rename lmao
    searchSettings: SearchSettings,
    searchQueries: Array<SearchQuery>
  ): Promise<SearchResults> {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker.editorSearch(searchSettings, searchQueries);
  }

  public async searchCardbacks(
    searchSettings: SearchSettings
  ): Promise<Array<string> | undefined> {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker.retrieveCardbackIdentifiers(searchSettings);
  }

  public async getCardDocuments(
    identifiersToSearch: Array<string>
  ): Promise<CardDocuments> {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker.getCardDocuments(identifiersToSearch);
  }

  public async getByID(
    identifier: string
  ): Promise<OramaCardDocument | undefined> {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker.getByID(identifier);
  }

  public async translateOramaCardDocumentToCardDocument(
    oramaCardDocument: OramaCardDocument
  ): Promise<CardDocument> {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker.translateOramaCardDocumentToCardDocument(
      oramaCardDocument
    );
  }

  public async getSampleCards(): Promise<
    { [cardType in CardType]: Array<CardDocument> } | undefined
  > {
    if (this.worker === undefined) {
      throw new Error("clientSearchService was not initialised!");
    }
    return this.worker.getSampleCards();
  }
}

export const clientSearchService = new ClientSearchService();
