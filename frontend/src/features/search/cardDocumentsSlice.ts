/**
 * State management for cards retrieved from the backend.
 */

import { createSlice } from "@reduxjs/toolkit";

import { APIGetCards } from "@/app/api";
import { CardDocumentsState, createAppAsyncThunk } from "@/common/types";
import { fetchCardbacks } from "@/features/card/cardbackSlice";
import { selectUniqueCardIdentifiers } from "@/features/project/projectSlice";
import { fetchCards } from "@/features/search/searchResultsSlice";

// TODO: we should write something to read a page of card IDs from searchResults (100 at a time?) and query the backend for their full data
export const fetchCardDocuments = createAppAsyncThunk(
  "cardDocuments/fetchCardDocuments",
  async (arg, thunkAPI) => {
    // TODO: paginate and introduce the concept of a search strategy
    // e.g. retrieve the first image for each selected image first, then fill out search results from top to bottom
    /**
     * This function queries card documents (entire database rows) from the backend. It only queries cards which have
     * not yet been queried.
     */

    await thunkAPI.dispatch(fetchCards());
    await thunkAPI.dispatch(fetchCardbacks());

    const state = thunkAPI.getState();

    const allIdentifiers = selectUniqueCardIdentifiers(state);
    const identifiersWithKnownData = new Set(
      Object.keys(state.cardDocuments.cardDocuments)
    );
    const identifiersToSearch = new Set(
      Array.from(allIdentifiers).filter(
        (item) => !identifiersWithKnownData.has(item)
      )
    );

    const backendURL = state.backend.url;
    if (identifiersToSearch.size > 0 && backendURL != null) {
      return APIGetCards(backendURL, identifiersToSearch);
    }
  }
);

const initialState: CardDocumentsState = {
  cardDocuments: {},
  status: "idle",
  error: null,
};

export const cardDocumentsSlice = createSlice({
  name: "cardDocuments",
  initialState,
  reducers: {
    addCardDocuments: (state, action) => {
      state.cardDocuments = { ...state.cardDocuments, ...action.payload };
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchCardDocuments.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(fetchCardDocuments.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.cardDocuments = { ...state.cardDocuments, ...action.payload };
      })
      .addCase(fetchCardDocuments.rejected, (state, action) => {
        state.status = "failed"; // TODO: build some stuff for displaying error messages
        state.error = ""; // TODO: // action.error.message ?? null;
      });
  },
});

export default cardDocumentsSlice.reducer;
