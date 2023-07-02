/**
 * State management for the backend that the app should communicate with as configured by the user.
 */

import { createSlice } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { BackendState } from "@/common/types";

const initialState: BackendState = {
  url: null,
};

export const backendSlice = createSlice({
  name: "backend",
  initialState,
  reducers: {
    setURL: (state, action) => {
      // TODO: can we force queries to re-fetch when we change the URL here?
      state.url = action.payload;
    },
    clearURL: (state) => {
      state.url = null;
    },
  },
});

export const { setURL, clearURL } = backendSlice.actions;
export default backendSlice.reducer;

export const selectBackendURL = (state: RootState) => state.backend.url;
