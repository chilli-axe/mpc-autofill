/**
 * State management for search results - what images are returned for what search queries.
 */

import { createSelector } from "@reduxjs/toolkit";

import { Back, SearchResultsEndpointPageSize } from "@/common/constants";
import {
  CardType,
  createAppAsyncThunk,
  createAppSlice,
  Faces,
  OramaSchema,
  SearchResults,
  SearchResultsState,
} from "@/common/types";
import { LocalFilesService } from "@/features/localFiles/localFilesService";
import { APIEditorSearch } from "@/store/api";
import { selectRemoteBackendURL } from "@/store/slices/backendSlice";
import { selectCardbacks } from "@/store/slices/cardbackSlice";
import { selectQueriesWithoutSearchResults } from "@/store/slices/projectSlice";
import { selectSearchSettings } from "@/store/slices/searchSettingsSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

//# region async thunk

const typePrefix = "searchResults/fetchCards";

const mergeSearchResults = (
  a: SearchResults,
  b: SearchResults
): SearchResults => {
  const mergedResults: SearchResults = structuredClone(a);
  for (const [query, searchResultsForQuery] of Object.entries(b)) {
    if (Object.prototype.hasOwnProperty.call(mergedResults, query)) {
      for (const [cardType, searchResults] of Object.entries(
        searchResultsForQuery
      ) as Array<[CardType, Array<string>]>) {
        if (
          Object.prototype.hasOwnProperty.call(mergedResults[query], cardType)
        ) {
          mergedResults[query][cardType] = [
            ...mergedResults[query][cardType],
            ...searchResults,
          ];
        } else {
          mergedResults[query][cardType] = [...searchResults];
        }
      }
    } else {
      mergedResults[query] = structuredClone(searchResultsForQuery);
    }
  }
  return mergedResults;
};

export const fetchSearchResults = createAppAsyncThunk(
  typePrefix,
  /**
   * concurrently resolve local and remote searches
   */
  async (arg, { getState, extra }) => {
    const state = getState();
    const { localFilesService } = extra as {
      localFilesService: LocalFilesService;
    };

    const queriesToSearch = selectQueriesWithoutSearchResults(state); // TODO: is there an edge case here when a local directory is added?
    const backendURL = selectRemoteBackendURL(state);
    const searchSettings = selectSearchSettings(state);

    const hasLocalFilesDirectoryHandle =
      await localFilesService.hasLocalFilesDirectoryHandle();
    const localResultsPromise: Promise<SearchResults> =
      hasLocalFilesDirectoryHandle
        ? localFilesService.editorSearch(searchSettings, queriesToSearch)
        : new Promise(async (resolve) => resolve({}));
    const remoteResultsPromise: Promise<SearchResults> =
      queriesToSearch.length > 0 && backendURL != null
        ? Array.from(
            Array(
              Math.ceil(queriesToSearch.length / SearchResultsEndpointPageSize)
            ).keys()
          ).reduce(function (
            promiseChain: Promise<SearchResults>,
            page: number
          ) {
            return promiseChain.then(async function (
              previousValue: SearchResults
            ) {
              const searchResults = await APIEditorSearch(
                backendURL,
                searchSettings,
                queriesToSearch.slice(
                  page * SearchResultsEndpointPageSize,
                  (page + 1) * SearchResultsEndpointPageSize
                )
              );
              return { ...previousValue, ...searchResults };
            });
          },
          Promise.resolve({}))
        : new Promise(async (resolve) => resolve({}));
    return await Promise.all([localResultsPromise, remoteResultsPromise]).then(
      ([localResults, remoteResults]) =>
        mergeSearchResults(localResults, remoteResults)
    );
  }
);

export async function fetchSearchResultsAndReportError(dispatch: AppDispatch) {
  try {
    await dispatch(fetchSearchResults()).unwrap();
  } catch (error: any) {
    dispatch(
      setNotification([
        typePrefix,
        { name: error.name, message: error.message, level: "error" },
      ])
    );
    return null;
  }
}

//# endregion

//# region slice configuration

const initialState: SearchResultsState = {
  searchResults: {},
  status: "idle",
  error: null,
};

export const searchResultsSlice = createAppSlice({
  name: "searchResults",
  initialState,
  reducers: {
    addSearchResults: (state, action) => {
      state.searchResults = { ...state.searchResults, ...action.payload };
    },
    clearSearchResults: (state) => {
      state.searchResults = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSearchResults.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(fetchSearchResults.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.searchResults = { ...state.searchResults, ...action.payload };
      })
      .addCase(fetchSearchResults.rejected, (state, action) => {
        state.status = "failed";
        state.error = {
          name: action.error.name ?? null,
          message: action.error.message ?? null,
          level: "error",
        };
      });
  },
});

export const { addSearchResults, clearSearchResults } =
  searchResultsSlice.actions;

export default searchResultsSlice.reducer;

//# endregion

//# region selectors

const defaultEmptySearchResults: Array<string> = [];

/**
 * Handle the fallback logic where cardbacks with no query use the common cardback's list of cards.
 */
export const selectSearchResultsForQueryOrDefault = createSelector(
  (
    state: RootState,
    query: string | null | undefined,
    cardType: CardType | undefined,
    face: Faces
  ) => state.searchResults.searchResults,
  (
    state: RootState,
    query: string | null | undefined,
    cardType: CardType | undefined,
    face: Faces
  ) => query,
  (
    state: RootState,
    query: string | null | undefined,
    cardType: CardType | undefined,
    face: Faces
  ) => cardType,
  (
    state: RootState,
    query: string | null | undefined,
    cardType: CardType | undefined,
    face: Faces
  ) => face,
  (
    state: RootState,
    query: string | null | undefined,
    cardType: CardType | undefined,
    face: Faces
  ) => selectCardbacks(state),
  (searchResults, query, cardType, face, cardbacks) =>
    query != null && query.length > 0 && cardType !== undefined
      ? (searchResults[query] ?? {})[cardType]
      : face === Back
      ? cardbacks
      : defaultEmptySearchResults
);

//# endregion
