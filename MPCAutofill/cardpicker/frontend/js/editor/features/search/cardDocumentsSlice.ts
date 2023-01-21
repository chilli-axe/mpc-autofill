import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import Cookies from "js-cookie";

import { RootState } from "../../app/store";
import { fetchCards } from "./searchResultsSlice";
import { fetchCardbacks } from "../card/cardbackSlice";
import { selectUniqueCardIdentifiers } from "../project/projectSlice";

// TODO: we should write something to read a page of card IDs from searchResults (100 at a time?) and query the backend for their full data
export const fetchCardDocuments = createAsyncThunk(
  "cardDocuments/fetchCardDocuments",
  async (arg, thunkAPI) => {
    // TODO: paginate
    /**
     * This function queries card documents (entire database rows) from the backend. It only queries cards which have
     * not yet been queried.
     */

    await thunkAPI.dispatch(fetchCards());
    await thunkAPI.dispatch(fetchCardbacks());

    // @ts-ignore  // TODO
    const state: RootState = thunkAPI.getState();

    const allIdentifiers = selectUniqueCardIdentifiers(state);
    const identifiersWithKnownData = new Set(
      Object.keys(state.cardDocuments.cardDocuments)
    );
    const identifiersToSearch = new Set(
      Array.from(allIdentifiers).filter(
        (item) => !identifiersWithKnownData.has(item)
      )
    );

    if (identifiersToSearch.size > 0) {
      const rawResponse = await fetch("/2/getCards/", {
        method: "POST",
        body: JSON.stringify({
          card_identifiers: Array.from(identifiersToSearch),
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

interface CardDocument {
  // This should match the data returned by `to_dict` on the `Card` Django model
  identifier: string;
  card_type: string;
  name: string;
  priority: number;
  source: string;
  source_verbose: string;
  source_type: string;
  dpi: number;
  searchq: string;
  extension: string;
  date: string; // formatted by backend
  download_link: string;
  size: number;
  small_thumbnail_url: string;
  medium_thumbnail_url: string;
}

interface CardDocuments {
  [key: string]: CardDocument;
}

interface CardDocumentsState {
  cardDocuments: CardDocuments;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string;
}

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
        state.error = action.error.message;
      });
  },
});

export default cardDocumentsSlice.reducer;
