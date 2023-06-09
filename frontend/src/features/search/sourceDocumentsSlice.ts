/**
 * State management for sources retrieved from the backend.
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { APIGetSources } from "@/app/api";
import { RootState } from "@/app/store";
import { SourceDocuments, SourceDocumentsState } from "@/common/types";

const initialState = {
  sourceDocuments: undefined,
} as SourceDocumentsState;

export const fetchSourceDocuments = createAsyncThunk(
  "sourceDocuments/fetchSourceDocuments",
  async (arg, thunkAPI) => {
    const state: RootState = thunkAPI.getState();
    return APIGetSources(state.backend.url);
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
      state.sourceDocuments = { ...state.sourceDocuments, ...action.payload };
    });
    builder.addCase(fetchSourceDocuments.rejected, (state, action) => {
      alert("TODO");
    });
  },
});

export default sourceDocumentsSlice.reducer;
export const selectSourceDocuments = (state: RootState) =>
  state.sourceDocuments.sourceDocuments;
