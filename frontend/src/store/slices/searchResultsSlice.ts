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
  SearchQuery,
  SearchResults,
  SearchResultsState,
} from "@/common/types";
import { APIEditorSearch } from "@/store/api";
import { selectBackendURL } from "@/store/slices/backendSlice";
import { selectCardbacks } from "@/store/slices/cardbackSlice";
import { selectQueriesWithoutSearchResults } from "@/store/slices/projectSlice";
import { selectSearchSettings } from "@/store/slices/searchSettingsSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

import { selectFavoriteIdentifiersSet } from "./favoritesSlice";

//# region async thunk

const typePrefix = "searchResults/fetchCards";

export const fetchSearchResults = createAppAsyncThunk(
  typePrefix,
  async (arg, { getState }) => {
    const state = getState();

    const queriesToSearch = selectQueriesWithoutSearchResults(state);
    const favoriteIdentifiersSet = selectFavoriteIdentifiersSet(state);

    const backendURL = selectBackendURL(state);
    const searchSettings = selectSearchSettings(state);
    if (queriesToSearch.length > 0 && backendURL != null) {
      return Array.from(
        Array(
          Math.ceil(queriesToSearch.length / SearchResultsEndpointPageSize)
        ).keys()
      ).reduce(function (promiseChain: Promise<SearchResults>, page: number) {
        return promiseChain.then(async function (previousValue: SearchResults) {
          const searchResults = await APIEditorSearch(
            backendURL,
            searchSettings,
            queriesToSearch.slice(
              page * SearchResultsEndpointPageSize,
              (page + 1) * SearchResultsEndpointPageSize
            ),
            favoriteIdentifiersSet
          );
          return { ...previousValue, ...searchResults };
        });
      }, Promise.resolve({}));
    } else {
      return null;
    }
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
