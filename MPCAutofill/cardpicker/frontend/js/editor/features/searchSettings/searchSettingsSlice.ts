import { createSlice } from "@reduxjs/toolkit";
import { MinimumDPI, MaximumDPI, MaximumSize } from "../../common/constants";
import { SearchSettings } from "../../common/types";

const initialState: SearchSettings = {
  searchTypeSettings: {
    fuzzySearch: false,
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
    setCardSources: (state, action) => {
      state.sourceSettings.sources = [...action.payload];
    },
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
export const {
  setCardSources,
  setSearchTypeSettings,
  setSourceSettings,
  setFilterSettings,
} = searchSettingsSlice.actions;
export default searchSettingsSlice.reducer;
