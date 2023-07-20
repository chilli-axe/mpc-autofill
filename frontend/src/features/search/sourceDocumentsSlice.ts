/**
 * State management for sources retrieved from the backend.
 */

import { createSlice } from "@reduxjs/toolkit";

import { APIGetSources } from "@/app/api";
import { AppDispatch, RootState } from "@/app/store";
import { createAppAsyncThunk, SourceDocumentsState } from "@/common/types";
import { setError } from "@/features/toasts/toastsSlice";

const initialState = {
  sourceDocuments: undefined,
} as SourceDocumentsState;

const typePrefix = "sourceDocuments/fetchSourceDocuments";

const fetchSourceDocuments = createAppAsyncThunk(
  typePrefix,
  async (arg, { getState }) => {
    const state = getState();
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
    builder
      .addCase(fetchSourceDocuments.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(fetchSourceDocuments.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.sourceDocuments = { ...state.sourceDocuments, ...action.payload };
      })
      .addCase(fetchSourceDocuments.rejected, (state, action) => {
        state.status = "failed";
        state.error = {
          name: action.error.name ?? null,
          message: action.error.message ?? null,
        };
      });
  },
});

export default sourceDocumentsSlice.reducer;
export const selectSourceDocuments = (state: RootState) =>
  state.sourceDocuments.sourceDocuments;

export async function fetchSourceDocumentsAndReportError(
  dispatch: AppDispatch
) {
  try {
    await dispatch(fetchSourceDocuments()).unwrap();
  } catch (error: any) {
    dispatch(
      setError([typePrefix, { name: error.name, message: error.message }])
    );
    return null;
  }
}
