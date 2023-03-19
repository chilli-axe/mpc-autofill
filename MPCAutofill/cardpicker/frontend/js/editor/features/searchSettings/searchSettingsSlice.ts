import { createSlice } from "@reduxjs/toolkit";
import { MinimumDPI, MaximumDPI, MaximumSize } from "../../common/constants";
import { SearchSettings } from "../../common/types";

const initialState: SearchSettings = {
  // TODO: this default is redundant through `cookies.ts`. reconsider this
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
