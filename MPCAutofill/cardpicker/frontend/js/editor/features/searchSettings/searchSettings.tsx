/**
 * A modal which allows users to control how the backend searches the database in various ways:
 *   a) Select precise or fuzzy (forgiving) search type
 *   b) Configure the allowable range for DPI and maximum file size
 *   c) Re-order the Sources to search and choose which Sources are enabled.
 * A button is exposed in the right-hand panel of the main GUI to show this modal.
 */

import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../app/store";
import {
  // setFuzzySearch,
  setCardSources,
  // setMinDPI,
  // setMaxDPI,
  // setMaxSize,
  setSearchTypeSettings,
  setSourceSettings,
  setFilterSettings,
} from "./searchSettingsSlice";
import {
  SearchTypeSettings,
  SourceSettings,
  FilterSettings,
} from "../../common/types";
import {
  getCookieSearchSettings,
  setCookieSearchSettings,
} from "../../common/cookies";
import { SearchTypeSettings as SearchTypeSettingsElement } from "./searchTypeSettings";
import { FilterSettings as FilterSettingsElement } from "./filterSettings";
import { SourceSettings as SourceSettingsElement } from "./sourceSettings";

export function SearchSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const [show, setShow] = useState(false);

  // global state managed in redux
  const globalSearchSettings = useSelector(
    (state: RootState) => state.searchSettings
  );

  // component-level copies of redux state
  const [localSearchTypeSettings, setLocalSearchTypeSettings] =
    useState<SearchTypeSettings>(globalSearchSettings.searchTypeSettings);
  const [localSourceSettings, setLocalSourceSettings] =
    useState<SourceSettings>(globalSearchSettings.sourceSettings);
  const [localFilterSettings, setLocalFilterSettings] =
    useState<FilterSettings>(globalSearchSettings.filterSettings);

  // const [localFuzzySearch, setLocalFuzzySearch] = useState<boolean>(
  //   globalSearchSettings.fuzzySearch
  // );
  // const [localSourceOrder, setLocalSourceOrder] = useState<Array<SourceRow>>(
  //   globalSearchSettings.cardSources ?? []
  // );
  // const [localMinimumDPI, setLocalMinimumDPI] = useState<number>(
  //   globalSearchSettings.minDPI
  // );
  // const [localMaximumDPI, setLocalMaximumDPI] = useState<number>(
  //   globalSearchSettings.maxDPI
  // );
  // const [localMaximumSize, setLocalMaximumSize] = useState<number>(
  //   globalSearchSettings.maxSize
  // );

  const maybeSourceDocuments = useSelector(
    (state: RootState) => state.sourceDocuments.sourceDocuments
  );

  useEffect(() => {
    if (maybeSourceDocuments != null) {
      const cookieSettings = getCookieSearchSettings(maybeSourceDocuments);

      if (cookieSettings != null) {
        setLocalSearchTypeSettings(cookieSettings.searchTypeSettings);
        setLocalSourceSettings(cookieSettings.sourceSettings);
        setFilterSettings(cookieSettings.filterSettings);
      }

      if (
        globalSearchSettings.sourceSettings.sources == null &&
        cookieSettings != null
      ) {
        // TODO: update this section after finishing the implementation of reconciling sources against cookies.
        dispatch(setSearchTypeSettings(cookieSettings.searchTypeSettings));
        dispatch(setSourceSettings(cookieSettings.sourceSettings));
        dispatch(setFilterSettings(cookieSettings.filterSettings));
      }
    }
  }, [maybeSourceDocuments]);

  // modal management functions
  const handleClose = () => setShow(false);
  const handleShow = () => {
    // set up the component-level state with the current redux state
    setLocalSearchTypeSettings(globalSearchSettings.searchTypeSettings);
    setLocalFilterSettings(globalSearchSettings.filterSettings);
    setLocalSourceSettings(globalSearchSettings.sourceSettings);

    setShow(true);
  };
  const handleSave = () => {
    // copy component-level state into redux state and into cookies
    setCookieSearchSettings({
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
        <i className="bi bi-gear" style={{ paddingRight: 0.5 + "em" }} />
        Search Settings
      </Button>

      <Modal show={show} onHide={handleSave}>
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
