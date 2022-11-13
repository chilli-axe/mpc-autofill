import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
import Cookies from "js-cookie";
import { CardTypes, SearchQuery } from "./constants";

// import { AnyAction } from 'redux'
// import { RootState } from './store'
// import { ThunkAction } from 'redux-thunk'

export const fetchCards = createAsyncThunk(
  "searchResults/fetchCards",
  async () => {
    const rawResponse = await fetch("/2/search/", {
      method: "POST",
      body: JSON.stringify({
        search_settings: {
          fuzzy_search: false,
          card_sources: ["chilli"],
          cardback_sources: ["chilli"],
          min_dpi: 0,
          max_dpi: 1500,
        },
        queries: [
          { query: "island", card_type: CardTypes.Card } as SearchQuery,
          { query: "past in flames", card_type: CardTypes.Card } as SearchQuery,
        ],
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

// const logAndAdd = (queries: Array<string>) => {
//   return (dispatch, getState) => {
//     const stateBefore = getState()
//     console.log(`Counter before: ${stateBefore.counter}`)
//     // dispatch(incrementByAmount(queries))
//     const stateAfter = getState()
//     console.log(`Counter after: ${stateAfter.counter}`)
//   }
// }

// export const addSearchResultsAsync = (queries: Array<[string, string]>) => (dispatch: any) => {
//   setTimeout(() => {
//     dispatch(addSearchResults(queries))
//   }, 1000)
// }

// Action creators are generated for each case reducer function
// export const { increment, decrement, incrementByAmount } = cardSlotSlice.actions

export default searchResultsSlice.reducer;
