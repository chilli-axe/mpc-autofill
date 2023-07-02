/**
 * State management for sources retrieved from the backend.
 */

import { createSlice } from "@reduxjs/toolkit";

import { APIGetSources } from "@/app/api";
import { RootState } from "@/app/store";
import { createAppAsyncThunk, SourceDocumentsState } from "@/common/types";

const initialState = {
  sourceDocuments: undefined,
} as SourceDocumentsState;

export const fetchSourceDocuments = createAppAsyncThunk(
  "sourceDocuments/fetchSourceDocuments",
  async (arg, thunkAPI) => {
    const state = thunkAPI.getState();
    return state.backend.url != null ? APIGetSources(state.backend.url) : null;
  }
);

export const sourceDocumentsSlice = createSlice({
  name: "sourceDocuments",
  initialState,
  reducers: {
    addSourceDocuments: (state, action) => {
      state.sourceDocuments = { ...state.sourceDocuments, ...action.payload };
    },
  },
  extraReducers(builder) {
    builder.addCase(fetchSourceDocuments.fulfilled, (state, action) => {
      if (action.payload != null) {
        state.sourceDocuments = { ...state.sourceDocuments, ...action.payload };
      }
    });
    builder.addCase(fetchSourceDocuments.rejected, (state, action) => {
      alert("fetching sources broke");
    });
  },
});

export default sourceDocumentsSlice.reducer;
export const selectSourceDocuments = (state: RootState) =>
  state.sourceDocuments.sourceDocuments;
