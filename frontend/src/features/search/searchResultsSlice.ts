/**
 * State management for search results - what images are returned for what search queries.
 */

import { createSlice } from "@reduxjs/toolkit";

import { APISearch } from "@/app/api";
import { AppDispatch } from "@/app/store";
import {
  APIError,
  createAppAsyncThunk,
  SearchResultsState,
} from "@/common/types";
import { selectQueriesWithoutSearchResults } from "@/features/project/projectSlice";
import { setError } from "@/features/toasts/toastsSlice";

const typePrefix = "searchResults/fetchCards";

const fetchSearchResults = createAppAsyncThunk(
  typePrefix,
  async (arg, { getState, rejectWithValue }) => {
    const state = getState();

    const queriesToSearch = selectQueriesWithoutSearchResults(state);

    const backendURL = state.backend.url;
    if (queriesToSearch.length > 0 && backendURL != null) {
      return await APISearch(backendURL, state.searchSettings, queriesToSearch); //.catch(error => rejectWithValue(error));
    } else {
      return null;
    }
  }
);

const initialState: SearchResultsState = {
  searchResults: {},
  status: "idle",
  error: null,
};

export const searchResultsSlice = createSlice({
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
  extraReducers(builder) {
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
        };
      });
  },
});
export const { addSearchResults, clearSearchResults } =
  searchResultsSlice.actions;

export default searchResultsSlice.reducer;

export async function fetchSearchResultsAndReportError(dispatch: AppDispatch) {
  try {
    await dispatch(fetchSearchResults()).unwrap();
  } catch (error: any) {
    dispatch(
      setError([typePrefix, { name: error.name, message: error.message }])
    );
    return null;
  }
}
