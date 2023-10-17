/**
 * A modal which allows users to control how the backend searches the database in various ways:
 *   a) Select precise or fuzzy (forgiving) search type
 *   b) Configure the allowable range for DPI and maximum file size
 *   c) Re-order the Sources to search and choose which Sources are enabled.
 * A button is exposed in the right-hand panel of the main GUI to show this modal.
 */

import React, { useCallback, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import {
  getLocalStorageSearchSettings,
  setLocalStorageSearchSettings,
} from "@/common/cookies";
import {
  FilterSettings,
  SearchTypeSettings,
  SourceSettings,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { selectSourceDocuments } from "@/features/search/sourceDocumentsSlice";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/filterSettings";
import {
  selectSearchSettings,
  setFilterSettings,
  setSearchTypeSettings,
  setSourceSettings,
} from "@/features/searchSettings/searchSettingsSlice";
import { SearchTypeSettings as SearchTypeSettingsElement } from "@/features/searchSettings/searchTypeSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/sourceSettings";

export function SearchSettings() {
  const dispatch = useAppDispatch();
  const [show, setShow] = useState<boolean>(false);

  // global state managed in redux
  const globalSearchSettings = useAppSelector(selectSearchSettings);

  // component-level copies of redux state
  const [localSearchTypeSettings, setLocalSearchTypeSettings] =
    useState<SearchTypeSettings>(globalSearchSettings.searchTypeSettings);
  const [localSourceSettings, setLocalSourceSettings] =
    useState<SourceSettings>(globalSearchSettings.sourceSettings);
  const [localFilterSettings, setLocalFilterSettings] =
    useState<FilterSettings>(globalSearchSettings.filterSettings);

  const maybeSourceDocuments = useAppSelector(selectSourceDocuments);

  useEffect(() => {
    if (maybeSourceDocuments != null) {
      const localStorageSettings =
        getLocalStorageSearchSettings(maybeSourceDocuments);
      dispatch(setSearchTypeSettings(localStorageSettings.searchTypeSettings));
      dispatch(setSourceSettings(localStorageSettings.sourceSettings));
      dispatch(setFilterSettings(localStorageSettings.filterSettings));
    }
  }, [dispatch, maybeSourceDocuments]);

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
          <hr />
          <SourceSettingsElement
            sourceSettings={localSourceSettings}
            setSourceSettings={setLocalSourceSettings}
          />
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
