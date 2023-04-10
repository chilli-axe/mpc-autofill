import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "@/app/store";

export const viewSettingsSlice = createSlice({
  name: "cardGrid",
  initialState: {
    frontsVisible: true,
  },
  reducers: {
    switchToFront: (state: RootState) => {
      state.frontsVisible = true;
    },
    switchToBack: (state: RootState) => {
      state.frontsVisible = false;
    },
    toggleFaces: (state: RootState) => {
      state.frontsVisible = !state.frontsVisible;
    },
  },
});

// Action creators are generated for each case reducer function
export const { switchToFront, switchToBack, toggleFaces } =
  viewSettingsSlice.actions;

export default viewSettingsSlice.reducer;
