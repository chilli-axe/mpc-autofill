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
  SourceRow,
  setFuzzySearch,
  setCardSources,
  setMinDPI,
  setMaxDPI,
  setMaxSize,
} from "./searchSettingsSlice";
import {
  getCookieSearchSettings,
  setCookieSearchSettings,
} from "../../common/cookies";
import { SearchTypeSettings } from "./searchTypeSettings";
import { FilterSettings } from "./filterSettings";
import { SourceSettings } from "./sourceSettings";

export function SearchSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const [show, setShow] = useState(false);

  // global state managed in redux
  const globalSearchSettings = useSelector(
    (state: RootState) => state.searchSettings
  );

  // component-level copies of redux state
  const [localFuzzySearch, setLocalFuzzySearch] = useState<boolean>(
    globalSearchSettings.fuzzySearch
  );
  const [localSourceOrder, setLocalSourceOrder] = useState<Array<SourceRow>>(
    globalSearchSettings.cardSources ?? []
  );
  const [localMinimumDPI, setLocalMinimumDPI] = useState<number>(
    globalSearchSettings.minDPI
  );
  const [localMaximumDPI, setLocalMaximumDPI] = useState<number>(
    globalSearchSettings.maxDPI
  );
  const [localMaximumSize, setLocalMaximumSize] = useState<number>(
    globalSearchSettings.maxSize
  );

  const maybeSourceDocuments = useSelector(
    (state: RootState) => state.sourceDocuments.sourceDocuments
  );

  useEffect(() => {
    if (maybeSourceDocuments != null) {
      const cookieSettings = getCookieSearchSettings();

      const unmatchedSources: Array<string> = Object.keys(maybeSourceDocuments);

      let selectedSources: Array<SourceRow> = unmatchedSources.map(
        (x: string) => [x, true]
      );

      if (cookieSettings != null) {
        // alert("cookieSettings not null")
        // dispatch(setFuzzySearch(cookieSettings.fuzzySearch));
        //
        // for (const man of cookieSettings.drives) {
        //   alert(JSON.stringify(man))
        // }

        // TODO: temporary
        selectedSources = unmatchedSources.map((x) => [x, true]);
      } else {
      }

      setLocalSourceOrder(selectedSources);

      /**
       * create a new object to track whether each drive is enabled or disabled. initialise as empty list. called `x`
       * for each item in cookie drives:
       * check if the item matches a drive fetched from the database
       * if it does, append to `x` the drive name and whether it's enabled or not, and remove the drive from the list
       * of sources retrieved from the database
       * once you reach the end of this loop, iterate over the remaining sources retrieved from the database,
       * and set them all to true.
       */
      if (globalSearchSettings.cardSources == null) {
        // TODO: update this section after finishing the implementation of reconciling sources against cookies.
        dispatch(setCardSources(selectedSources));
      }
    }
  }, [maybeSourceDocuments]);

  // modal management functions
  const handleClose = () => setShow(false);
  const handleShow = () => {
    // set up the component-level state with the current redux state
    setLocalSourceOrder(globalSearchSettings.cardSources);
    setLocalFuzzySearch(globalSearchSettings.fuzzySearch);
    setLocalMinimumDPI(globalSearchSettings.minDPI);
    setLocalMaximumDPI(globalSearchSettings.maxDPI);
    setLocalMaximumSize(globalSearchSettings.maxSize);

    setShow(true);
  };
  const handleSave = () => {
    // copy component-level state into redux state and into cookies
    setCookieSearchSettings({
      fuzzySearch: localFuzzySearch,
      drives: localSourceOrder,
    });
    dispatch(setFuzzySearch(localFuzzySearch));
    dispatch(setCardSources(localSourceOrder));
    dispatch(setMinDPI(localMinimumDPI));
    dispatch(setMaxDPI(localMaximumDPI));
    dispatch(setMaxSize(localMaximumSize));

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
          <SearchTypeSettings
            localFuzzySearch={localFuzzySearch}
            setLocalFuzzySearch={setLocalFuzzySearch}
          />
          <hr />
          <FilterSettings
            localMinimumDPI={localMinimumDPI}
            localMaximumDPI={localMaximumDPI}
            localMaximumSize={localMaximumSize}
            setLocalMinimumDPI={setLocalMinimumDPI}
            setLocalMaximumDPI={setLocalMaximumDPI}
            setLocalMaximumSize={setLocalMaximumSize}
          />
          <hr />
          <SourceSettings
            localSourceOrder={localSourceOrder}
            setLocalSourceOrder={setLocalSourceOrder}
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
