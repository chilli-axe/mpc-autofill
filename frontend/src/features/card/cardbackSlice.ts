/**
 * State management for cardbacks retrieved from the backend.
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { APIGetCardbacks } from "@/app/api";
import { RootState } from "@/app/store";
import { CardbacksState, CardDocuments } from "@/common/types";

export const fetchCardbacks = createAsyncThunk(
  "cardbacks/fetchCardbacks",
  async (arg, thunkAPI) => {
    const state: RootState = thunkAPI.getState();
    return APIGetCardbacks(state.backend.url);
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
    addCardbackDocuments: (state: RootState, action) => {
      state.cardbacks = [...action.payload];
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchCardbacks.pending, (state: RootState, action) => {
        state.status = "loading";
      })
      .addCase(fetchCardbacks.fulfilled, (state: RootState, action) => {
        state.status = "succeeded";
        state.cardbacks = [...action.payload];
      })
      .addCase(fetchCardbacks.rejected, (state: RootState, action) => {
        state.status = "failed"; // TODO: build some stuff for displaying error messages
        state.error = ""; // TODO:  // action.error.message ?? null;
      });
  },
});

export default cardbackSlice.reducer;
