/**
 * State management for the backend that the app should communicate with as configured by the user.
 */

import { BackendState } from "@/common/types";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "@/app/store";
import { APIGetBackendInfo } from "@/app/api";

export const fetchInfo = createAsyncThunk(
  "backend/fetchInfo",
  async (arg, thunkAPI) => {
    const state: RootState = thunkAPI.getState();
    return APIGetBackendInfo(state.backend.url);
  }
);

const initialState: BackendState = {
  url: null,
  info: undefined,
};

export const backendSlice = createSlice({
  name: "backend",
  initialState,
  reducers: {
    setURL: (state: RootState, action) => {
      state.url = action.payload;
    },
    clearURL: (state: RootState) => {
      state.url = undefined;
      state.info = undefined;
    },
    setInfo: (state: RootState, action) => {
      state.info = action.payload;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchInfo.pending, (state: RootState, action) => {
        state.status = "loading";
      })
      .addCase(fetchInfo.fulfilled, (state: RootState, action) => {
        state.status = "succeeded";
        state.info = action.payload;
      })
      .addCase(fetchInfo.rejected, (state: RootState, action) => {
        state.status = "failed"; // TODO: build some stuff for displaying error messages
        state.error = ""; // TODO:  // action.error.message ?? null;
      });
  },
});

export const { setURL, clearURL, setInfo } = backendSlice.actions;
export default backendSlice.reducer;
