import { PayloadAction } from "@reduxjs/toolkit";

import { Back, Front } from "@/common/constants";
import { createAppSlice, Faces, ViewSettingsState } from "@/common/types";
import { RootState } from "@/store/store";

//# region slice configuration

const initialState: ViewSettingsState = {
  frontsVisible: true,
  sourcesVisible: {},
  facetBySource: false, // opt out of the new grid selector UX by default
  jumpToVersionVisible: false,
};

export const viewSettingsSlice = createAppSlice({
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
    toggleJumpToVersionVisible: (state) => {
      state.jumpToVersionVisible = !state.jumpToVersionVisible;
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
  toggleJumpToVersionVisible,
} = viewSettingsSlice.actions;

export default viewSettingsSlice.reducer;

//# endregion

//# region selectors

export const selectFrontsVisible = (state: RootState) =>
  state.viewSettings.frontsVisible;
export const selectActiveFace = (state: RootState): Faces =>
  state.viewSettings.frontsVisible ? Front : Back;
export const selectSourcesVisible = (state: RootState) =>
  state.viewSettings.sourcesVisible;
export const selectFacetBySource = (state: RootState) =>
  state.viewSettings.facetBySource;
export const selectAnySourcesCollapsed = (state: RootState) =>
  Object.values(state.viewSettings.sourcesVisible ?? {}).includes(false);
export const selectJumpToVersionVisible = (state: RootState) =>
  state.viewSettings.jumpToVersionVisible;

//# endregion
