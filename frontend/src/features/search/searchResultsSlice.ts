/**
 * State management for search results - what images are returned for what search queries.
 */

import { APISearch } from "@/app/api";
import { AppDispatch, RootState } from "@/app/store";
import { Back, SearchResultsEndpointPageSize } from "@/common/constants";
import {
  createAppAsyncThunk,
  createAppSlice,
  Faces,
  SearchQuery,
  SearchResults,
  SearchResultsState,
} from "@/common/types";
import { selectBackendURL } from "@/features/backend/backendSlice";
import { selectQueriesWithoutSearchResults } from "@/features/project/projectSlice";
import { selectSearchSettings } from "@/features/searchSettings/SearchSettingsSlice";
import { setNotification } from "@/features/toasts/toastsSlice";

//# region async thunk

const typePrefix = "searchResults/fetchCards";

export const fetchSearchResults = createAppAsyncThunk(
  typePrefix,
  async (arg, { getState }) => {
    const state = getState();

    const queriesToSearch = selectQueriesWithoutSearchResults(state);

    const backendURL = selectBackendURL(state);
    const searchSettings = selectSearchSettings(state);
    if (queriesToSearch.length > 0 && backendURL != null) {
      return Array.from(
        Array(
          Math.ceil(queriesToSearch.length / SearchResultsEndpointPageSize)
        ).keys()
      ).reduce(function (promiseChain: Promise<SearchResults>, page: number) {
        return promiseChain.then(async function (previousValue: SearchResults) {
          const searchResults = await APISearch(
            backendURL,
            searchSettings,
            queriesToSearch.slice(
              page * SearchResultsEndpointPageSize,
              (page + 1) * SearchResultsEndpointPageSize
            )
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

export const selectSearchResultsForQuery = (
  state: RootState,
  searchQuery: SearchQuery | undefined
) =>
  searchQuery?.query != null
    ? (state.searchResults.searchResults[searchQuery.query] ?? {})[
        searchQuery.card_type
      ]
    : undefined;

const defaultEmptySearchResults: Array<string> = [];

/**
 * Handle the fallback logic where cardbacks with no query use the common cardback's list of cards.
 */
export const selectSearchResultsForQueryOrDefault = (
  state: RootState,
  searchQuery: SearchQuery | null | undefined,
  face: Faces,
  cardbacks: Array<string>
): Array<string> | undefined =>
  searchQuery?.query != null && searchQuery.query.length > 0
    ? selectSearchResultsForQuery(state, searchQuery)
    : face === Back
    ? cardbacks
    : defaultEmptySearchResults;

//# endregion
