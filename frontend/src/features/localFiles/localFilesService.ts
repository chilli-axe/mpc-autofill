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

import { LocalFilesServiceWorker } from "./localFilesService.worker";

/**
 * work around next.js limitation where workers cannot be initialised at the module level
 * because of SSR hydration
 */
export class LocalFilesService {
  worker: Remote<LocalFilesServiceWorker> | undefined;
  constructor() {
    this.worker = undefined;
  }

  public initialiseWorker() {
    const worker = new Worker(
      new URL("./localFilesService.worker.ts", import.meta.url),
      {
        type: "module",
      }
    );
    this.worker = wrap<LocalFilesServiceWorker>(worker);
  }

  // this is really awkward sorry. going to duplicate all public method definitions on localFilesService
  // and plumb through to the worker.
  // 2025-01-10 - above comment is no longer strictly correct. this layer now has all the redux store interactions.
  public async hasDirectoryHandle(): Promise<boolean> {
    return this.worker?.hasDirectoryHandle() ?? false;
  }

  public async getDirectoryHandle(): Promise<
    FileSystemDirectoryHandle | undefined
  > {
    return this.worker?.getDirectoryHandle();
  }

  public async setDirectoryHandle(
    directoryHandle: FileSystemDirectoryHandle | undefined,
    state: RootState,
    dispatch: AppDispatch,
    forceUpdate: DispatchWithoutAction,
    tags: Array<Tag> | undefined
  ) {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    await this.worker.setDirectoryHandle(directoryHandle, tags);
    await this.indexDirectory(dispatch, forceUpdate, tags);
    await recalculateSearchResults(state, dispatch, true);
  }

  public async clearDirectoryHandle(state: RootState, dispatch: AppDispatch) {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker
      .clearDirectoryHandle()
      .then(() => recalculateSearchResults(state, dispatch, true));
  }

  public async indexDirectory(
    dispatch: AppDispatch,
    forceUpdate: DispatchWithoutAction,
    tags: Array<Tag> | undefined
  ): Promise<{ handle: FileSystemDirectoryHandle; size: number } | undefined> {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    const indexDirectoryResult = await this.worker.indexDirectory(tags);
    if (indexDirectoryResult !== undefined) {
      const { handle, size } = indexDirectoryResult;
      dispatch(
        setNotification([
          Math.random().toString(),
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

    return indexDirectoryResult;
  }

  public async getDirectoryIndexSize(): Promise<number | undefined> {
    return this.worker?.getDirectoryIndexSize();
  }

  public async search(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number
  ): Promise<Array<{ id: string; document: OramaCardDocument }> | undefined> {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker.search(searchSettings, query, cardTypes, limit);
  }

  public async searchIdentifiers(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>,
    limit?: number
  ): Promise<Array<string> | undefined> {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker.searchIdentifiers(
      searchSettings,
      query,
      cardTypes,
      limit
    );
  }
  public async searchBig(
    // TODO: rename lmao
    searchSettings: SearchSettings,
    searchQueries: Array<SearchQuery>
  ): Promise<SearchResults> {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker.searchBig(searchSettings, searchQueries);
  }

  public async searchCardbacks(
    searchSettings: SearchSettings
  ): Promise<Array<string> | undefined> {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker.searchCardbacks(searchSettings);
  }

  public async getLocalCardDocuments(
    identifiersToSearch: Array<string>
  ): Promise<CardDocuments> {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker.getLocalCardDocuments(identifiersToSearch);
  }

  public async getByID(
    identifier: string
  ): Promise<OramaCardDocument | undefined> {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker.getByID(identifier);
  }

  public async translateOramaCardDocumentToCardDocument(
    oramaCardDocument: OramaCardDocument
  ): Promise<CardDocument> {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker.translateOramaCardDocumentToCardDocument(
      oramaCardDocument
    );
  }

  public async getSampleCards(): Promise<
    { [cardType in CardType]: Array<CardDocument> } | undefined
  > {
    if (this.worker === undefined) {
      throw new Error("localFilesService was not initialised!");
    }
    return this.worker.getSampleCards();
  }
}

export const localFilesService = new LocalFilesService();
