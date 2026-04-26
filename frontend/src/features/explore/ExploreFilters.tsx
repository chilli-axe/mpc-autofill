import {
  BackendType,
  CardType,
  FilterSettings,
  SearchTypeSettings,
  SortBy,
  SourceSettings,
} from "@/common/types";
import { CardTypeFilter } from "@/features/filters/CardTypeFilter";
import { CompressedFilter } from "@/features/filters/CompressedFilter";
import { SearchQueryFilter } from "@/features/filters/SearchQueryFilter";
import { SortByFilter } from "@/features/filters/SortByFilter";
import { SourceBackendFilter } from "@/features/filters/SourceBackendFilter";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/FilterSettings";
import { SearchTypeSettings as SearchTypeSettingsElement } from "@/features/searchSettings/SearchTypeSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/SourceSettings";

interface ExploreFiltersProps {
  compressed: boolean;
  setCompressed: (value: boolean) => void;
  backendType: BackendType;
  setBackendType: (value: BackendType) => void;
  sortBy: SortBy;
  setSortBy: (value: SortBy) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  cardTypes: Array<CardType>;
  setCardTypes: (value: Array<CardType>) => void;
  searchTypeSettings: SearchTypeSettings;
  setSearchTypeSettings: (value: SearchTypeSettings) => void;
  filterSettings: FilterSettings;
  setFilterSettings: (value: FilterSettings) => void;
  sourceSettings: SourceSettings;
  setSourceSettings: (value: SourceSettings) => void;
}

export const ExploreFilters = ({
  compressed,
  setCompressed,
  backendType,
  setBackendType,
  sortBy,
  setSortBy,
  searchQuery,
  setSearchQuery,
  cardTypes,
  setCardTypes,
  searchTypeSettings,
  setSearchTypeSettings,
  filterSettings,
  setFilterSettings,
  sourceSettings,
  setSourceSettings,
}: ExploreFiltersProps) => {
  return (
    <>
      <SourceBackendFilter
        backendType={backendType}
        setBackendType={setBackendType}
      />
      <hr />
      <h5>View Settings</h5>
      <CompressedFilter compressed={compressed} setCompressed={setCompressed} />
      <hr />
      <h5>Sort By</h5>
      <SortByFilter sortBy={sortBy} setSortBy={setSortBy} />
      <hr />
      <h5>Search Query</h5>
      <SearchQueryFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <CardTypeFilter cardTypes={cardTypes} setCardTypes={setCardTypes} />
      <hr />
      <SearchTypeSettingsElement
        searchTypeSettings={searchTypeSettings}
        setSearchTypeSettings={setSearchTypeSettings}
        enableFiltersApplyToCardbacks={false}
      />
      <hr />
      <FilterSettingsElement
        filterSettings={filterSettings}
        setFilterSettings={setFilterSettings}
      />
      {backendType === "remote" && (
        <>
          <hr />
          <SourceSettingsElement
            sourceSettings={sourceSettings}
            setSourceSettings={setSourceSettings}
            enableReorderingSources={false}
          />
        </>
      )}
    </>
  );
};
