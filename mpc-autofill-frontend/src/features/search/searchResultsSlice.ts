import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { RootState } from "../../app/store";
import { selectQueriesWithoutSearchResults } from "../project/projectSlice";
import { APISearch } from "../../app/api";
import { SearchResultsState } from "../../common/types";

export const fetchCards = createAsyncThunk(
  "searchResults/fetchCards",
  async (arg, thunkAPI) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore  // TODO
    const state: RootState = thunkAPI.getState();

    const queriesToSearch = selectQueriesWithoutSearchResults(state);
    if (queriesToSearch.length > 0) {
      return APISearch(state.searchSettings, queriesToSearch);
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
  },
});
export const { addSearchResults, clearSearchResults } =
  searchResultsSlice.actions;

export default searchResultsSlice.reducer;
