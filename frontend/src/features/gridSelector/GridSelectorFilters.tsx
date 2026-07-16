import { Ref } from "react";
import Container from "react-bootstrap/Container";

import { Printing } from "@/common/constants";
import {
  FilterSettings,
  SourceSettings,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { SortBy } from "@/common/types";
import { AutofillCollapse } from "@/components/AutofillCollapse";
import { CanonicalCardFilter } from "@/features/filters/CanonicalCardFilter";
import { NullableSortByFilter } from "@/features/filters/SortByFilter";
import { ViewSettings } from "@/features/filters/ViewSettings";
import { JumpToVersion } from "@/features/gridSelector/JumpToVersion";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/FilterSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/SourceSettings";
import {
  selectFilterVisible,
  selectJumpToVersionVisible,
  selectSortVisible,
  selectViewVisible,
  toggleFilterVisible,
  toggleJumpToVersionVisible,
  toggleSortVisible,
  toggleViewVisible,
} from "@/store/slices/viewSettingsSlice";

interface GridSelectorFiltersProps {
  imageIdentifiers: Array<string>;
  focusRef: Ref<HTMLInputElement>;
  selectImage: (identifier: string) => void;
  sortBy: SortBy | undefined;
  setSortBy: (value: SortBy | undefined) => void;
  printings: Array<Printing>;
  setPrintings: (printings: Array<Printing>) => void;
  artists: Array<string>;
  setArtists: (printings: Array<string>) => void;
  filterSettings: FilterSettings;
  setFilterSettings: (value: FilterSettings) => void;
  sourceSettings: SourceSettings;
  setSourceSettings: (value: SourceSettings) => void;
  projectFilter: FilterSettings | undefined; // TODO: terrible name for this.
}

export const GridSelectorFilters = ({
  imageIdentifiers,
  focusRef,
  selectImage,
  sortBy,
  setSortBy,
  printings,
  setPrintings,
  artists,
  setArtists,
  filterSettings,
  setFilterSettings,
  sourceSettings,
  setSourceSettings,
  projectFilter,
}: GridSelectorFiltersProps) => {
  // TODO:
  // constrain languages according to gloabl search settings
  // do the same for tags
  const dispatch = useAppDispatch();
  const jumpToVersionVisible = useAppSelector(selectJumpToVersionVisible);
  const viewVisible = useAppSelector(selectViewVisible);
  const sortVisible = useAppSelector(selectSortVisible);
  const filterVisible = useAppSelector(selectFilterVisible);

  return (
    <Container className="px-1">
      <AutofillCollapse
        expanded={jumpToVersionVisible}
        onClick={() => dispatch(toggleJumpToVersionVisible())}
        zIndex={4}
        title={<h5>Jump to Version</h5>}
        sticky={false}
        pad={2}
      >
        <JumpToVersion
          imageIdentifiers={imageIdentifiers}
          focusRef={focusRef}
          selectImage={selectImage}
        />
      </AutofillCollapse>
      <AutofillCollapse
        expanded={viewVisible}
        onClick={() => dispatch(toggleViewVisible())}
        zIndex={3}
        title={<h5>View</h5>}
        sticky={false}
        pad={2}
      >
        <ViewSettings />
      </AutofillCollapse>
      <AutofillCollapse
        expanded={sortVisible}
        onClick={() => dispatch(toggleSortVisible())}
        zIndex={2}
        title={<h5>Sort</h5>}
        sticky={false}
        pad={2}
      >
        <NullableSortByFilter sortBy={sortBy} setSortBy={setSortBy} />
      </AutofillCollapse>
      <AutofillCollapse
        expanded={filterVisible}
        onClick={() => dispatch(toggleFilterVisible())}
        zIndex={1}
        title={<h5>Filter</h5>}
        sticky={false}
        pad={2}
      >
        <>
          <CanonicalCardFilter
            imageIdentifiers={imageIdentifiers}
            printings={printings}
            setPrintings={setPrintings}
            artists={artists}
            setArtists={setArtists}
          />
          <FilterSettingsElement
            filterSettings={filterSettings}
            setFilterSettings={setFilterSettings}
            minDPILowerBound={projectFilter?.minimumDPI}
            maxDPIUpperBound={projectFilter?.maximumDPI}
            maxSizeUpperBound={projectFilter?.maximumSize}
            showBoilerplate={false}
            // allowedLanguages={allowedLanguages}
          />
          <SourceSettingsElement
            sourceSettings={sourceSettings}
            setSourceSettings={setSourceSettings}
            enableReorderingSources={false}
            showBoilerplate={false}
          />
        </>
      </AutofillCollapse>
    </Container>
  );
};
