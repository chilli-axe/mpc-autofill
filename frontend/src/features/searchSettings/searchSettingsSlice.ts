import { createSlice } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { MaximumDPI, MaximumSize, MinimumDPI } from "@/common/constants";
import { SearchSettings } from "@/common/types";

//# region slice configuration

const initialState: SearchSettings = {
  // TODO: this default is redundant through `cookies.ts`. reconsider this
  searchTypeSettings: {
    fuzzySearch: false,
    filterCardbacks: false,
  },
  sourceSettings: {
    sources: null,
  },
  filterSettings: {
    minimumDPI: MinimumDPI,
    maximumDPI: MaximumDPI,
    maximumSize: MaximumSize,
  },
};

export const searchSettingsSlice = createSlice({
  name: "searchSettings",
  initialState,
  reducers: {
    setSearchTypeSettings: (state, action) => {
      state.searchTypeSettings = action.payload;
    },
    setSourceSettings: (state, action) => {
      state.sourceSettings = action.payload;
    },
    setFilterSettings: (state, action) => {
      state.filterSettings = action.payload;
    },
  },
});

export const { setSearchTypeSettings, setSourceSettings, setFilterSettings } =
  searchSettingsSlice.actions;
export default searchSettingsSlice.reducer;

//# endregion

//# region selectors

export const selectSearchSettings = (state: RootState) => state.searchSettings;
export const selectSearchSettingsSourcesValid = (state: RootState) =>
  state.searchSettings.sourceSettings.sources != null;
export const selectStringifiedSearchSettings = (state: RootState) =>
  JSON.stringify(state.searchSettings);

//# endregion
