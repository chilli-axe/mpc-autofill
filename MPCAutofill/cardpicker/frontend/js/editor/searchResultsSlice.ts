import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
import Cookies from "js-cookie";
import { CardTypes, SearchQuery } from "./constants";
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
          (state.searchResults.searchResults[projectMember.query.query] ?? {})[
            projectMember.query.card_type
          ] == undefined
        ) {
          // results for this query have not been retrieved & stored yet
          queriesToSearch.push(projectMember.query);
        }
      }
    }

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
);

type SearchResultsForQuery = {
  [card_type in CardTypes]: string;
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
  searchResults: {}, // search query & card type -> number of hits + list of card IDs
  status: "idle",
  error: null,
};

export const searchResultsSlice = createSlice({
  name: "searchResults",
  initialState,
  reducers: {
    addSearchResults: (state, action) => {
      // state.results.push(...action.payload)
      state.searchResults = { ...state.searchResults, ...action.payload };
    },
    clearSearchResults: (state, action) => {
      state.searchResults = {};
    },
  },
  extraReducers(builder) {
    // omit posts loading reducers
    builder.addCase(fetchCards.fulfilled, (state, action) => {
      // We can directly add the new post object to our posts array
      // state.posts.push(action.payload)
      state.searchResults = { ...state.searchResults, ...action.payload };
    });
  },
});
export const { addSearchResults } = searchResultsSlice.actions;

export default searchResultsSlice.reducer;
