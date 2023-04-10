/**
 * State management for the backend that the app should communicate with as configured by the user.
 */

import { BackendState } from "@/common/types";
import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "@/app/store";

const initialState: BackendState = {
  url: null,
};

export const backendSlice = createSlice({
  name: "backend",
  initialState,
  reducers: {
    setURL: (state: RootState, action) => {
      // TODO: can we force queries to re-fetch when we change the URL here?
      state.url = action.payload;
    },
    clearURL: (state: RootState) => {
      state.url = undefined;
    },
  },
});

export const { setURL, clearURL } = backendSlice.actions;
export default backendSlice.reducer;
