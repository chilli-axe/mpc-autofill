import {
  FilterSettings,
  SearchTypeSettings,
  SourceSettings,
  useAppSelector,
} from "@/common/types";
import {
  getDefaultSearchSettings,
  selectSearchSettings,
} from "@/store/slices/searchSettingsSlice";
import { selectSourceDocuments } from "@/store/slices/sourceDocumentsSlice";

export const areSetsEqual = (a: Set<any>, b: Set<any>) =>
  a.size === b.size && a.isSubsetOf(b);

export const sourceSettingsToSet = (
  sourceSettings: SourceSettings
): Set<number> =>
  new Set(
    sourceSettings.sources.flatMap((sourceSetting) =>
      sourceSetting[1] ? [Number(sourceSetting[0])] : []
    )
  );

export const compareFilterSettings = (
  filterSettings: FilterSettings,
  defaultFilterSettings: FilterSettings
): number =>
  (!areSetsEqual(
    new Set(filterSettings.excludesTags),
    new Set(defaultFilterSettings.excludesTags)
  )
    ? 1
    : 0) +
  (!areSetsEqual(
    new Set(filterSettings.includesTags),
    new Set(defaultFilterSettings.includesTags)
  )
    ? 1
    : 0) +
  (!areSetsEqual(
    new Set(filterSettings.languages),
    new Set(defaultFilterSettings.languages)
  )
    ? 1
    : 0) +
  (filterSettings.maximumDPI !== defaultFilterSettings.maximumDPI ? 1 : 0) +
  (filterSettings.maximumSize !== defaultFilterSettings.maximumSize ? 1 : 0) +
  (filterSettings.minimumDPI !== defaultFilterSettings.minimumDPI ? 1 : 0);
export const compareSearchTypeSettings = (
  searchTypeSettings: SearchTypeSettings,
  defaultSearchTypeSettings: SearchTypeSettings
): number =>
  (searchTypeSettings.filterCardbacks !==
  defaultSearchTypeSettings.filterCardbacks
    ? 1
    : 0) +
  (searchTypeSettings.fuzzySearch !== defaultSearchTypeSettings.fuzzySearch
    ? 1
    : 0);
export const compareSourceSettings = (
  sourceSettings: SourceSettings,
  defaultSourceSettings: SourceSettings
): number => {
  const sourceSettingsSet = sourceSettingsToSet(sourceSettings);
  const defaultSourceSettingsSet = sourceSettingsToSet(defaultSourceSettings);
  return sourceSettingsSet.symmetricDifference(defaultSourceSettingsSet).size;
};

export const useCountSearchSettingsVaryingFromDefault = (): number => {
  const searchSettings = useAppSelector(selectSearchSettings);
  const sourceDocuments = useAppSelector(selectSourceDocuments);
  const defaultSearchSettings = getDefaultSearchSettings(
    sourceDocuments ?? [],
    false
  );
  return (
    compareFilterSettings(
      searchSettings.filterSettings,
      defaultSearchSettings.filterSettings
    ) +
    compareSearchTypeSettings(
      searchSettings.searchTypeSettings,
      defaultSearchSettings.searchTypeSettings
    ) +
    compareSourceSettings(
      searchSettings.sourceSettings,
      defaultSearchSettings.sourceSettings
    )
  );
};
