import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import Cookies from "js-cookie";

export const fetchCardbacks = createAsyncThunk(
  "cardbacks/fetchCardbacks",
  async (arg, thunkAPI) => {
    const rawResponse = await fetch("/2/getCardbacks/", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken"),
      },
    });
    const content = await rawResponse.json();
    return content.cardbacks;
  }
);

interface CardbacksState {
  cardbacks: Array<string>;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string;
}

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
        state.error = action.error.message;
      });
  },
});

export default cardbackSlice.reducer;
