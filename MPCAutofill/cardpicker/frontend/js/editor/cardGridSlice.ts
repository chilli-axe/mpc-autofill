import { createSlice } from "@reduxjs/toolkit";
import { Front, Back } from "./constants";

export const cardGridSlice = createSlice({
  name: "cardGrid",
  initialState: {
    activeFace: Front,
  },
  reducers: {
    switchToFront: (state) => {
      state.activeFace = Front;
    },
    switchToBack: (state) => {
      state.activeFace = Back;
    },
  },
});

// Action creators are generated for each case reducer function
export const { switchToFront, switchToBack } = cardGridSlice.actions;

export default cardGridSlice.reducer;
