/**
 * State management for sources retrieved from the backend.
 */

import { createSelector, createSlice } from "@reduxjs/toolkit";

import { APIGetSources } from "@/app/api";
import { AppDispatch, RootState } from "@/app/store";
import { createAppAsyncThunk, SourceDocumentsState } from "@/common/types";
import { setNotification } from "@/features/toasts/toastsSlice";

//# region async thunk

const typePrefix = "sourceDocuments/fetchSourceDocuments";

export const fetchSourceDocuments = createAppAsyncThunk(
  typePrefix,
  async (arg, { getState }) => {
    const state = getState();
    return state.backend.url != null ? APIGetSources(state.backend.url) : null;
  }
);

export async function fetchSourceDocumentsAndReportError(
  dispatch: AppDispatch
) {
  try {
    await dispatch(fetchSourceDocuments()).unwrap();
  } catch (error: any) {
    dispatch(
      setNotification([
        typePrefix,
        { name: error.name, message: error.message, level: "error" },
      ])
    );
    return null;
  }
}

//# endregion

//# region slice configuration

const initialState = {
  sourceDocuments: undefined,
} as SourceDocumentsState;

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
          level: "error",
        };
      });
  },
});

export default sourceDocumentsSlice.reducer;

//# endregion

//# region selectors

export const selectSourceDocuments = (state: RootState) =>
  state.sourceDocuments.sourceDocuments;

export const selectSourceNamesByKey = createSelector(
  (state: RootState) => state.sourceDocuments.sourceDocuments,
  (sourceDocuments) =>
    sourceDocuments != null
      ? Object.fromEntries(
          Object.values(sourceDocuments).map((sourceDocument) => [
            sourceDocument.key,
            sourceDocument.name,
          ])
        )
      : {}
);

//# endregion
