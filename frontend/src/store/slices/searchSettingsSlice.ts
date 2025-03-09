import { MaximumDPI, MaximumSize, MinimumDPI } from "@/common/constants";
import {
  createAppSlice,
  SearchSettings,
  SourceDocument,
  SourceDocuments,
  SourceSettings,
} from "@/common/types";
import { RootState } from "@/store/store";

//# region slice configuration

export function getDefaultSourceSettings(
  sourceDocuments: SourceDocuments
): SourceSettings {
  return {
    sources: Object.values(sourceDocuments).map(
      (sourceDocument: SourceDocument) => [sourceDocument.pk, true]
    ),
  };
}

export function getDefaultSearchSettings(
  sourceDocuments: SourceDocuments,
  fuzzySearchByDefault: boolean = false
): SearchSettings {
  return {
    searchTypeSettings: {
      fuzzySearch: fuzzySearchByDefault,
      filterCardbacks: false,
    },
    sourceSettings: getDefaultSourceSettings(sourceDocuments),
    filterSettings: {
      minimumDPI: MinimumDPI,
      maximumDPI: MaximumDPI,
      maximumSize: MaximumSize,
      languages: [],
      includesTags: [],
      excludesTags: ["NSFW"],
    },
  };
}

const initialState = getDefaultSearchSettings({});

export const searchSettingsSlice = createAppSlice({
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
