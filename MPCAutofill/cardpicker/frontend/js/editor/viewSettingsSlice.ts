import { createSlice } from "@reduxjs/toolkit";

export const viewSettingsSlice = createSlice({
  name: "cardGrid",
  initialState: {
    frontsVisible: true,
  },
  reducers: {
    switchToFront: (state) => {
      state.frontsVisible = true;
    },
    switchToBack: (state) => {
      state.frontsVisible = false;
    },
    toggleFaces: (state) => {
      state.frontsVisible = !state.frontsVisible;
    },
  },
});

// Action creators are generated for each case reducer function
export const { switchToFront, switchToBack, toggleFaces } =
  viewSettingsSlice.actions;

export default viewSettingsSlice.reducer;
