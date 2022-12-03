import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import Cookies from "js-cookie";

import { RootState } from "./store";
import { fetchCards } from "./searchResultsSlice";

// TODO: we should write something to read a page of card IDs from searchResults (100 at a time?) and query the backend for their full data
export const fetchCardDocuments = createAsyncThunk(
  "cardDocuments/fetchCardDocuments",
  async (arg, thunkAPI) => {
    // @ts-ignore  // TODO
    const state: RootState = thunkAPI.getState();
    await thunkAPI.dispatch(fetchCards());

    // identify queries with no search results
    let allIdentifiers: Set<string> = new Set();
    for (const slotProjectMembers of state.project.members) {
      for (const [face, projectMember] of Object.entries(slotProjectMembers)) {
        if (
          (
            (state.searchResults.searchResults[projectMember.query.query] ??
              {})[projectMember.query.card_type] ?? []
          ).length > 0
        ) {
          // results for this identifier have not been retrieved & stored yet
          state.searchResults.searchResults[projectMember.query.query][
            projectMember.query.card_type
          ].forEach((x) => allIdentifiers.add(x));
        }
      }
    }
    const identifiersWithResults = new Set(
      Object.keys(state.cardDocuments.cardDocuments)
    );
    const identifiersToSearch = new Set(
      Array.from(allIdentifiers).filter(
        (item) => !identifiersWithResults.has(item)
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
