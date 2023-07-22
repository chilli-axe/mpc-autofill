import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { ViewSettingsState } from "@/common/types";

//# region slice configuration

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

//# endregion

//# region selectors

export const selectFrontsVisible = (state: RootState) =>
  state.viewSettings.frontsVisible;
export const selectSourcesVisible = (state: RootState) =>
  state.viewSettings.sourcesVisible;
export const selectFacetBySource = (state: RootState) =>
  state.viewSettings.facetBySource;
export const selectAnySourcesCollapsed = (state: RootState) =>
  Object.values(state.viewSettings.sourcesVisible ?? {}).includes(false);

//# endregion
