import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { ViewSettingsState } from "@/common/types";

const initialState: ViewSettingsState = {
  frontsVisible: true,
  sourcesVisible: {},
  facetBySource: true, // opt into the new grid selector UX by default
};

export const viewSettingsSlice = createSlice({
  name: "viewSettings",
  initialState,
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
    toggleSourceVisible: (state, action: PayloadAction<string>) => {
      state.sourcesVisible = {
        ...state.sourcesVisible,
        [action.payload]: !(state.sourcesVisible[action.payload] ?? true),
      };
    },
    makeAllSourcesVisible: (state) => {
      state.sourcesVisible = {};
    },
    makeAllSourcesInvisible: (state, action: PayloadAction<Array<string>>) => {
      state.sourcesVisible = Object.fromEntries(
        action.payload.map((x) => [x, false])
      );
    },
    toggleFacetBySource: (state) => {
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
