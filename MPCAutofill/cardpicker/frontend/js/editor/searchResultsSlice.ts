import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import Cookies from "js-cookie";
import { CardTypes } from "./constants";
import { RootState } from "./store";

export const fetchCards = createAsyncThunk(
  "searchResults/fetchCards",
  async (arg, thunkAPI) => {
    // @ts-ignore  // TODO
    const state: RootState = thunkAPI.getState();

    // identify queries with no search results
    let queriesToSearch = [];
    for (const slotProjectMembers of state.project.members) {
      for (const [face, projectMember] of Object.entries(slotProjectMembers)) {
        if (
          projectMember != null &&
          projectMember.query != null &&
          (state.searchResults.searchResults[projectMember.query.query] ?? {})[
            projectMember.query.card_type
          ] == undefined
        ) {
          // results for this query have not been retrieved & stored yet
          queriesToSearch.push(projectMember.query);
        }
      }
    }

    if (queriesToSearch.length > 0) {
      const rawResponse = await fetch("/2/search/", {
        method: "POST",
        body: JSON.stringify({
          searchSettings: state.searchSettings,
          queries: queriesToSearch,
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
  [card_type in CardTypes]: Array<string>;
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
