import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { APIGetCardbacks } from "@/app/api";
import { CardbacksState } from "@/common/types";

export const fetchCardbacks = createAsyncThunk(
  "cardbacks/fetchCardbacks",
  async (arg, thunkAPI) => {
    return APIGetCardbacks();
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
        state.status = "succeeded";
        state.cardbacks = [...action.payload];
      })
      .addCase(fetchCardbacks.rejected, (state, action) => {
        state.status = "failed"; // TODO: build some stuff for displaying error messages
        state.error = action.error.message ?? null;
      });
  },
});

export default cardbackSlice.reducer;
