/**
 * A modal which allows users to control how the backend searches the database in various ways:
 *   a) Select precise or fuzzy (forgiving) search type
 *   b) Configure the allowable range for DPI and maximum file size
 *   c) Re-order the Sources to search and choose which Sources are active.
 * A button is exposed in the right-hand panel of the main GUI to show this modal.
 */

import React, { useCallback, useState } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import { setLocalStorageSearchSettings } from "@/common/cookies";
import {
  FilterSettings,
  SearchTypeSettings,
  SourceSettings,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/FilterSettings";
import { SearchTypeSettings as SearchTypeSettingsElement } from "@/features/searchSettings/SearchTypeSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/SourceSettings";
import { selectRemoteBackendConfigured } from "@/store/slices/backendSlice";
import {
  getDefaultSearchSettings,
  selectSearchSettings,
  setFilterSettings,
  setSearchTypeSettings,
  setSourceSettings,
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

export function SearchSettings() {
  const dispatch = useAppDispatch();
  const [show, setShow] = useState<boolean>(false);
  const remoteBackendConfigured = useAppSelector(selectRemoteBackendConfigured);

  // global state managed in redux
  const globalSearchSettings = useAppSelector(selectSearchSettings);

  // component-level copies of redux state
  const [localSearchTypeSettings, setLocalSearchTypeSettings] =
    useState<SearchTypeSettings>(globalSearchSettings.searchTypeSettings);
  const [localSourceSettings, setLocalSourceSettings] =
    useState<SourceSettings>(globalSearchSettings.sourceSettings);
  const [localFilterSettings, setLocalFilterSettings] =
    useState<FilterSettings>(globalSearchSettings.filterSettings);

  const countSearchSettingsVaryingFromDefault =
    useCountSearchSettingsVaryingFromDefault();

  // modal management functions
  const handleClose = () => setShow(false);

  const handleShow = useCallback(() => {
    // set up the component-level state with the current redux state
    setLocalSearchTypeSettings(globalSearchSettings.searchTypeSettings);
    setLocalFilterSettings(globalSearchSettings.filterSettings);
    setLocalSourceSettings(globalSearchSettings.sourceSettings);

    setShow(true);
  }, [globalSearchSettings]);
  const handleSave = () => {
    // copy component-level state into redux state and into local storage
    setLocalStorageSearchSettings({
      searchTypeSettings: localSearchTypeSettings,
      sourceSettings: localSourceSettings,
      filterSettings: localFilterSettings,
    });
    dispatch(setSearchTypeSettings(localSearchTypeSettings));
    dispatch(setSourceSettings(localSourceSettings));
    dispatch(setFilterSettings(localFilterSettings));

    handleClose();
  };

  return (
    <div className="d-grid gap-0">
      <Button variant="primary" onClick={handleShow}>
        <RightPaddedIcon bootstrapIconName="gear" />
        Search Settings
        {countSearchSettingsVaryingFromDefault !== 0 && (
          <>
            {" "}
            <Badge bg="success" pill>
              {countSearchSettingsVaryingFromDefault}
            </Badge>
          </>
        )}
      </Button>

      <Modal
        scrollable
        show={show}
        onHide={handleSave}
        data-testid="search-settings"
      >
        <Modal.Header closeButton>
          <Modal.Title>Search Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <SearchTypeSettingsElement
            searchTypeSettings={localSearchTypeSettings}
            setSearchTypeSettings={setLocalSearchTypeSettings}
          />
          <hr />
          <FilterSettingsElement
            filterSettings={localFilterSettings}
            setFilterSettings={setLocalFilterSettings}
          />
          {remoteBackendConfigured && (
            <>
              <hr />
              <SourceSettingsElement
                sourceSettings={localSourceSettings}
                setSourceSettings={setLocalSourceSettings}
              />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close Without Saving
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
