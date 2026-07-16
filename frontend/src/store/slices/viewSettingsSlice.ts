import { createSelector, PayloadAction } from "@reduxjs/toolkit";

import { Back, Front } from "@/common/constants";
import {
  createAppSlice,
  Faces,
  FacetBy,
  ViewSettingsState,
} from "@/common/types";
import { RootState } from "@/store/store";

//# region slice configuration

const initialState: ViewSettingsState = {
  frontsVisible: true,
  facetsVisible: {},
  facetBy: "None",
  compressed: true,
  jumpToVersionVisible: false,
  viewVisible: true,
  sortVisible: true,
  filterVisible: true,
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
    setFacetKeys: (state, action: PayloadAction<Array<string>>) => {
      state.facetsVisible = Object.fromEntries(
        action.payload.map((facetKey) => [
          facetKey,
          state.facetsVisible[facetKey] ?? true,
        ])
      );
    },
    setFacetVisible: (state, action: PayloadAction<string>) => {
      state.facetsVisible = {
        ...state.facetsVisible,
        [action.payload]: true,
      };
    },
    setFacetInvisible: (state, action: PayloadAction<string>) => {
      state.facetsVisible = {
        ...state.facetsVisible,
        [action.payload]: false,
      };
    },
    makeAllFacetsVisible: (state) => {
      state.facetsVisible = Object.fromEntries(
        Object.entries(state.facetsVisible).map(([facetKey, visible]) => [
          facetKey,
          true,
        ])
      );
    },
    makeAllFacetsInvisible: (state) => {
      state.facetsVisible = Object.fromEntries(
        Object.entries(state.facetsVisible).map(([facetKey, visible]) => [
          facetKey,
          false,
        ])
      );
    },
    setFacetBy: (state, action: PayloadAction<FacetBy>) => {
      state.facetBy = action.payload;
    },
    setCompressed: (state, action: PayloadAction<boolean>) => {
      state.compressed = action.payload;
    },
    toggleJumpToVersionVisible: (state) => {
      state.jumpToVersionVisible = !state.jumpToVersionVisible;
    },
    toggleViewVisible: (state) => {
      state.viewVisible = !state.viewVisible;
    },
    toggleSortVisible: (state) => {
      state.sortVisible = !state.sortVisible;
    },
    toggleFilterVisible: (state) => {
      state.filterVisible = !state.filterVisible;
    },
  },
});

export const {
  switchToFront,
  switchToBack,
  toggleFaces,
  setFacetKeys,
  setFacetVisible,
  setFacetInvisible,
  makeAllFacetsVisible,
  makeAllFacetsInvisible,
  setFacetBy,
  setCompressed,
  toggleJumpToVersionVisible,
  toggleViewVisible,
  toggleSortVisible,
  toggleFilterVisible,
} = viewSettingsSlice.actions;

export default viewSettingsSlice.reducer;

//# endregion

//# region selectors

export const selectFrontsVisible = (state: RootState) =>
  state.viewSettings.frontsVisible;
export const selectActiveFace = (state: RootState): Faces =>
  state.viewSettings.frontsVisible ? Front : Back;
export const selectFacetsVisible = (state: RootState) =>
  state.viewSettings.facetsVisible;
export const selectFacetBy = (state: RootState) => state.viewSettings.facetBy;
export const selectCompressed = (state: RootState) =>
  state.viewSettings.compressed;
export const selectAnyFacetsCollapsed = createSelector(
  (state: RootState) => state.viewSettings.facetsVisible,
  (facetsVisible) => Object.values(facetsVisible ?? {}).includes(false)
);
export const selectJumpToVersionVisible = (state: RootState) =>
  state.viewSettings.jumpToVersionVisible;
export const selectViewVisible = (state: RootState) =>
  state.viewSettings.viewVisible;
export const selectSortVisible = (state: RootState) =>
  state.viewSettings.sortVisible;
export const selectFilterVisible = (state: RootState) =>
  state.viewSettings.filterVisible;

//# endregion
