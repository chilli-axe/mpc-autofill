/**
 * State management for cardbacks retrieved from the backend.
 */

import { createSlice } from "@reduxjs/toolkit";

import { APIGetCardbacks } from "@/app/api";
import { CardbacksState, createAppAsyncThunk } from "@/common/types";

export const fetchCardbacks = createAppAsyncThunk(
  "cardbacks/fetchCardbacks",
  async (arg, thunkAPI) => {
    const state = thunkAPI.getState();
    const backendURL = state.backend.url;
    return backendURL != null ? APIGetCardbacks(backendURL) : null;
  }
);

const initialState: CardbacksState = {
  cardbacks: [],
  status: "idle",
  error: null,
};

export const cardbackSlice = createSlice({
  name: "cardbacks",
  initialState,
  reducers: {
    addCardbackDocuments: (state, action) => {
      state.cardbacks = [...action.payload];
    },
  },
  extraReducers(builder) {
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
        state.status = "failed"; // TODO: build some stuff for displaying error messages
        state.error = ""; // TODO:  // action.error.message ?? null;
      });
  },
});

export default cardbackSlice.reducer;
