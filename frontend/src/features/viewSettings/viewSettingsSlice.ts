import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "@/app/store";
import { Faces, ViewSettingsState } from "@/common/types";

const initialState: ViewSettingsState = {
  frontsVisible: true,
  sourcesVisible: {},
};

export const viewSettingsSlice = createSlice({
  name: "cardGrid",
  initialState,
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
    toggleSourceVisible: (state: RootState, action: PayloadAction<string>) => {
      state.sourcesVisible = {
        ...state.sourcesVisible,
        [action.payload]: !(state.sourcesVisible[action.payload] ?? true),
      };
    },
  },
});

// Action creators are generated for each case reducer function
export const { switchToFront, switchToBack, toggleFaces, toggleSourceVisible } =
  viewSettingsSlice.actions;

export default viewSettingsSlice.reducer;
