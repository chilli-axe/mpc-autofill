/**
 * State management for sources retrieved from the backend.
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { APIGetSources } from "@/app/api";
import { SourceDocuments, SourceDocumentsState } from "@/common/types";
import { RootState } from "@/app/store";

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
    addSourceDocuments: (state: RootState, action) => {
      state.sourceDocuments = { ...state.sourceDocuments, ...action.payload };
    },
  },
  extraReducers(builder) {
    builder.addCase(
      fetchSourceDocuments.fulfilled,
      (state: RootState, action) => {
        state.sourceDocuments = { ...state.sourceDocuments, ...action.payload };
      }
    );
    builder.addCase(
      fetchSourceDocuments.rejected,
      (state: RootState, action) => {
        alert("TODO");
      }
    );
  },
});

export default sourceDocumentsSlice.reducer;
