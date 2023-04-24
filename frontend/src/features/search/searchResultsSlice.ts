/**
 * State management for search results - what images are returned for what search queries.
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "@/app/store";
import { selectQueriesWithoutSearchResults } from "../project/projectSlice";
import { APISearch } from "@/app/api";
import { SearchResults, SearchResultsState } from "@/common/types";

export const fetchCards = createAsyncThunk(
  "searchResults/fetchCards",
  async (arg, thunkAPI) => {
    const state: RootState = thunkAPI.getState();

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
  status: "idle", // TODO: I guess we have to manage this ourselves? I thought redux had tooling to manage this
  error: null,
};

export const searchResultsSlice = createSlice({
  name: "searchResults",
  initialState,
  reducers: {
    addSearchResults: (state: RootState, action) => {
      state.searchResults = { ...state.searchResults, ...action.payload };
    },
    clearSearchResults: (state: RootState) => {
      state.searchResults = {};
    },
  },
  extraReducers(builder) {
    builder.addCase(fetchCards.fulfilled, (state: RootState, action) => {
      state.searchResults = { ...state.searchResults, ...action.payload };
    });
    builder.addCase(fetchCards.rejected, (state: RootState, action) => {
      alert("TODO");
    });
  },
});
export const { addSearchResults, clearSearchResults } =
  searchResultsSlice.actions;

export default searchResultsSlice.reducer;
