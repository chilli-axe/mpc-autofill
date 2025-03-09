/**
 * State management for image downloads.
 * Synchronised with queue used for downloads (as reading from this queue across the app seems hard).
 */

import { PayloadAction } from "@reduxjs/toolkit";

import {
  createAppSlice,
  EnqueueFileDownload,
  FileDownload,
  FileDownloadsState,
  FileDownloadStatus,
} from "@/common/types";
import { RootState } from "@/store/store";

//# region slice configuration

const initialState: FileDownloadsState = {};

export const fileDownloadsSlice = createAppSlice({
  name: "fileDownloads",
  initialState,
  reducers: {
    enqueueDownload: (state, action: PayloadAction<EnqueueFileDownload>) => {
      return {
        ...state, // TODO: performance of this?
        [action.payload.id]: {
          name: action.payload.name,
          type: action.payload.type,
          enqueuedTimestamp: action.payload.enqueuedTimestamp,
          status: undefined,
          startedTimestamp: undefined,
          completedTimestamp: undefined,
        },
      };
    },
    startDownload: (
      state,
      action: PayloadAction<{ id: string; startedTimestamp: string }>
    ) => {
      return {
        ...state,
        [action.payload.id]: {
          ...state[action.payload.id], // TODO: what happens if this doesn't exist?
          startedTimestamp: action.payload.startedTimestamp,
        },
      };
    },
    stopDownload: (
      state,
      action: PayloadAction<{
        id: string;
        completedTimestamp: string;
        status: FileDownloadStatus;
      }>
    ) => {
      return {
        ...state,
        [action.payload.id]: {
          ...state[action.payload.id],
          status: action.payload.status,
          startedTimestamp:
            state[action.payload.id].startedTimestamp ??
            action.payload.completedTimestamp,
          completedTimestamp: action.payload.completedTimestamp,
        },
      };
    },
  },
});

export const { enqueueDownload, startDownload, stopDownload } =
  fileDownloadsSlice.actions;
export default fileDownloadsSlice.reducer;

//# endregion

//# region selectors

export const selectSortedFileDownloads = (
  state: RootState
): Array<{ id: string; fileDownload: FileDownload }> =>
  Object.entries(state.fileDownloads)
    .map(([id, fileDownload]) => ({ id, fileDownload }))
    .sort((a, b) => {
      const aActive = a.fileDownload.status === undefined;
      const bActive = b.fileDownload.status === undefined;
      return aActive && bActive
        ? // sort active downloads by name
          b.fileDownload.name.localeCompare(a.fileDownload.name)
        : !aActive && !bActive
        ? // sort completed downloads by completed timestamp
          new Date(b.fileDownload.completedTimestamp!).getTime() -
          new Date(a.fileDownload.completedTimestamp!).getTime()
        : // active downloads should be included first, and completed downloads second
          Number(bActive) - Number(aActive);
    });

//# endregion
