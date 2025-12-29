/**
 * State management for cardbacks retrieved from the backend.
 */

import { createSelector } from "@reduxjs/toolkit";

import {
  CardbacksState,
  createAppAsyncThunk,
  createAppSlice,
} from "@/common/types";
import { LocalFilesService } from "@/features/localFiles/localFilesService";
import { APIGetCardbacks } from "@/store/api";
import { selectBackendURL } from "@/store/slices/backendSlice";
import { selectSearchSettings } from "@/store/slices/searchSettingsSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

//# region async thunk

const typePrefix = "cardbacks/fetchCardbacks";

export const fetchCardbacks = createAppAsyncThunk(
  typePrefix,
  async (arg, { getState, extra }) => {
    const state = getState();
    const { localFilesService } = extra as {
      // TODO: move this extra type into types.ts
      localFilesService: LocalFilesService;
    };
    const backendURL = selectBackendURL(state);
    const searchSettings = selectSearchSettings(state);
    if (backendURL != null) {
      return APIGetCardbacks(backendURL, searchSettings).then(
        (remoteResults) => {
          console.log("in the big handler");
          if (localFilesService.hasDirectoryHandle()) {
            console.log("understand we want to search local cardbacks");
            const localResults =
              localFilesService.searchCardbacks(searchSettings);
            console.log("localResults", localResults);
            return [...(localResults ?? []), ...remoteResults];
          } else {
            return remoteResults;
          }
        }
      );
    } else {
      return null;
    }
  }
);

export async function fetchCardbacksAndReportError(dispatch: AppDispatch) {
  try {
    await dispatch(fetchCardbacks()).unwrap();
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

const initialState: CardbacksState = {
  cardbacks: [],
  status: "idle",
  error: null,
};

export const cardbackSlice = createAppSlice({
  name: "cardbacks",
  initialState,
  reducers: {
    addCardbackDocuments: (state, action) => {
      state.cardbacks = [...action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCardbacks.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(fetchCardbacks.fulfilled, (state, action) => {
        if (action.payload != null) {
          state.status = "succeeded";
          state.cardbacks = [...action.payload];
        } else {
          state.status = "failed";
        }
      })
      .addCase(fetchCardbacks.rejected, (state, action) => {
        state.status = "failed";
        state.error = {
          name: action.error.name ?? null,
          message: action.error.message ?? null,
          level: "error",
        };
      });
  },
});

export default cardbackSlice.reducer;

//# endregion

//# region selectors

const defaultEmptyCardbacks: Array<string> = [];
export const selectCardbacks = createSelector(
  // TODO: produces a warning in console for returning input w/ no modifications
  (state: RootState) => state.cardbacks.cardbacks,
  (cardbacks) => cardbacks ?? defaultEmptyCardbacks
);

//# endregion
