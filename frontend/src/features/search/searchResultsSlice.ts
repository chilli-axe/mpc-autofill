/**
 * State management for search results - what images are returned for what search queries.
 */

import { createSlice } from "@reduxjs/toolkit";

import { APISearch } from "@/app/api";
import { createAppAsyncThunk, SearchResultsState } from "@/common/types";
import { selectQueriesWithoutSearchResults } from "@/features/project/projectSlice";

export const fetchCards = createAppAsyncThunk(
  "searchResults/fetchCards",
  async (arg, thunkAPI) => {
    const state = thunkAPI.getState();

    const queriesToSearch = selectQueriesWithoutSearchResults(state);
    if (queriesToSearch.length > 0) {
      return APISearch(
        state.backend.url,
        state.searchSettings,
        queriesToSearch
      );
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
    builder.addCase(fetchCards.fulfilled, (state, action) => {
      state.searchResults = { ...state.searchResults, ...action.payload };
    });
    builder.addCase(fetchCards.rejected, (state, action) => {
      alert("fetching cards broke");
    });
  },
});
export const { addSearchResults, clearSearchResults } =
  searchResultsSlice.actions;

export default searchResultsSlice.reducer;
