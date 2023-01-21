import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import Cookies from "js-cookie";
import { Back, CardType } from "../../common/constants";
import { RootState } from "../../app/store";
import { selectQueriesWithoutSearchResults } from "../project/projectSlice";
import { useSelector } from "react-redux";

export const fetchCards = createAsyncThunk(
  "searchResults/fetchCards",
  async (arg, thunkAPI) => {
    // @ts-ignore  // TODO
    const state: RootState = thunkAPI.getState();

    const queriesToSearch = selectQueriesWithoutSearchResults(state);
    if (queriesToSearch.size > 0) {
      const rawResponse = await fetch("/2/search/", {
        method: "POST",
        body: JSON.stringify({
          searchSettings: state.searchSettings,
          queries: Array.from(queriesToSearch),
        }),
        credentials: "same-origin",
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken"),
        },
      });
      const content = await rawResponse.json();

      return content.results;
    }
  }
);

type SearchResultsForQuery = {
  [card_type in CardType]: Array<string>;
};

interface SearchResults {
  [query: string]: SearchResultsForQuery;
}

interface SearchResultsState {
  searchResults: SearchResults;
  status: string;
  error: string;
}

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
    clearSearchResults: (state, action) => {
      state.searchResults = {};
    },
  },
  extraReducers(builder) {
    builder.addCase(fetchCards.fulfilled, (state, action) => {
      state.searchResults = { ...state.searchResults, ...action.payload };
    });
  },
});
export const { addSearchResults } = searchResultsSlice.actions;

export default searchResultsSlice.reducer;
