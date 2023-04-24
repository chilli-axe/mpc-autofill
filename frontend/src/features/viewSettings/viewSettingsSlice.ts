import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "@/app/store";
import { ViewSettingsState } from "@/common/types";

const initialState: ViewSettingsState = {
  frontsVisible: true,
  sourcesVisible: {},
  facetBySource: true, // opt into the new grid selector UX by default
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
    makeAllSourcesVisible: (state: RootState) => {
      state.sourcesVisible = {};
    },
    makeAllSourcesInvisible: (
      state: RootState,
      action: PayloadAction<Array<string>>
    ) => {
      state.sourcesVisible = Object.fromEntries(
        action.payload.map((x) => [x, false])
      );
    },
    toggleFacetBySource: (state: RootState) => {
      state.facetBySource = !state.facetBySource;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  switchToFront,
  switchToBack,
  toggleFaces,
  toggleSourceVisible,
  makeAllSourcesVisible,
  makeAllSourcesInvisible,
  toggleFacetBySource,
} = viewSettingsSlice.actions;

export default viewSettingsSlice.reducer;
