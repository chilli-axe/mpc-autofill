import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import Cookies from "js-cookie";

interface SourceDocument {
  // This should match the data returned by `to_dict` on the `Source` Django model
  pk: number;
  key: string;
  name: string;
  identifier: string;
  source_type: string; // TODO
  external_link?: string;
  description: string;
}

interface SourceDocuments {
  [key: string]: SourceDocument;
}

interface SourceDocumentsState {
  sourceDocuments?: SourceDocuments;
}

const initialState: SourceDocumentsState = {
  sourceDocuments: null,
};

export const fetchSourceDocuments = createAsyncThunk(
  "sourceDocuments/fetchSourceDocuments",
  async () => {
    const rawResponse = await fetch("/2/getSources/", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken"),
      },
    });
    const content = await rawResponse.json();
    return content.results;
  }
);

export const sourceDocumentsSlice = createSlice({
  name: "sourceDocuments",
  initialState,
  reducers: {},
  extraReducers(builder) {
    // omit posts loading reducers
    builder.addCase(fetchSourceDocuments.fulfilled, (state, action) => {
      state.sourceDocuments = { ...state.sourceDocuments, ...action.payload };
    });
  },
});

export default sourceDocumentsSlice.reducer;
