import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { APIGetSources } from "@/app/api";
import { SourceDocumentsState } from "@/common/types";

const initialState: SourceDocumentsState = {
  sourceDocuments: undefined,
};

export const fetchSourceDocuments = createAsyncThunk(
  "sourceDocuments/fetchSourceDocuments",
  async () => {
    return APIGetSources();
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
