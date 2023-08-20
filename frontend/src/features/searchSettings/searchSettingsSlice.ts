import { createSlice } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { MaximumDPI, MaximumSize, MinimumDPI } from "@/common/constants";
import {
  SearchSettings,
  SourceDocument,
  SourceDocuments,
} from "@/common/types";

//# region slice configuration

export function getDefaultSearchSettings(
  sourceDocuments: SourceDocuments
): SearchSettings {
  return {
    searchTypeSettings: { fuzzySearch: false, filterCardbacks: false },
    sourceSettings: {
      sources: Object.values(sourceDocuments).map(
        (sourceDocument: SourceDocument) => [sourceDocument.pk, true]
      ),
    },
    filterSettings: {
      minimumDPI: MinimumDPI,
      maximumDPI: MaximumDPI,
      maximumSize: MaximumSize,
      languages: [],
      tags: [],
    },
  };
}

const initialState = getDefaultSearchSettings({});

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
export const selectFuzzySearch = (state: RootState) =>
  state.searchSettings.searchTypeSettings.fuzzySearch;
export const selectSearchSettingsSourcesValid = (state: RootState) =>
  state.searchSettings.sourceSettings.sources != null;

//# endregion
