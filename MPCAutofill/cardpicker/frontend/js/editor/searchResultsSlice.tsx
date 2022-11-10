import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import Cookies from "js-cookie";

// import { AnyAction } from 'redux'
// import { RootState } from './store'
// import { ThunkAction } from 'redux-thunk'

export const searchResultsSlice = createSlice({
  name: "searchResults",
  initialState: {
    results: {},
    status: "idle",
    error: null,
  },
  reducers: {
    addSearchResults: (state, action) => {
      state.results = { ...state.results, ...action.payload };
    },
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

export const fetchCards = createAsyncThunk(
  "searchResults/fetchCards",
  async () => {
    alert("in fetchCards async thunk2");
    // return {};
    const rawResponse = await fetch("/2/search/", {
      method: "POST",
      body: JSON.stringify({
        fuzzy_search: false,
        card_sources: ["chilli"],
        cardback_sources: ["chilli"],
        min_dpi: 0,
        max_dpi: 1500,
        queries: [
          { query: "island", card_type: "CARD" },
          { query: "past in flames", card_type: "CARD" },
        ],
      }),
      credentials: "same-origin",
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken"),
      },
    });
    // return rawResponse
    const content = await rawResponse.json();
    alert(JSON.stringify(content));
    return content;
  }
);

// Action creators are generated for each case reducer function
// export const { increment, decrement, incrementByAmount } = cardSlotSlice.actions

export default searchResultsSlice.reducer;
