/**
 * State management for sources retrieved from the backend.
 */

import { createSelector } from "@reduxjs/toolkit";

import {
  createAppAsyncThunk,
  createAppSlice,
  SourceDocumentsState,
} from "@/common/types";
import { APIGetSources } from "@/store/api";
import { selectBackendURL } from "@/store/slices/backendSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

//# region async thunk

const typePrefix = "sourceDocuments/fetchSourceDocuments";

export const fetchSourceDocuments = createAppAsyncThunk(
  typePrefix,
  async (arg, { getState }) => {
    const state = getState();
    const backendURL = selectBackendURL(state);
    return backendURL != null ? APIGetSources(backendURL) : null;
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

export const sourceDocumentsSlice = createAppSlice({
  name: "sourceDocuments",
  initialState,
  reducers: {
    addSourceDocuments: (state, action) => {
      state.sourceDocuments = { ...state.sourceDocuments, ...action.payload };
    },
  },
  extraReducers: (builder) => {
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
