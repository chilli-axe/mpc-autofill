/**
 * This component displays all `CardSlot`s in the project and is responsible for
 * querying the server for search results as necessary.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/app/store";
import { MemoizedCardSlot } from "./cardSlot";
import { fetchCardDocuments } from "../search/cardDocumentsSlice";
import { clearSearchResults } from "../search/searchResultsSlice";
import { Back, Front } from "@/common/constants";
import Row from "react-bootstrap/Row";
import {
  selectProjectMemberQueries,
  selectProjectMembers,
} from "../project/projectSlice";
import Modal from "react-bootstrap/Modal";
import { MemoizedCardDetailedView } from "./cardDetailedView";
import { ThunkDispatch } from "redux-thunk";

export function CardGrid() {
  const dispatch = useDispatch<ThunkDispatch<any, any, any>>();

  const [detailedViewSelectedImage, setDetailedViewSelectedImage] = useState<
    string | null
  >(null);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const handleCloseDetailedView = () => setShowDetailedView(false);
  const handleShowDetailedView = useCallback((selectedImage: string) => {
    setDetailedViewSelectedImage(selectedImage);
    setShowDetailedView(true);
  }, []);

  // TODO: this doesn't work yet
  const searchResultsIdle = // TODO: replace the magic string here with a constant
    useSelector((state: RootState) => state.searchResults.status) === "idle";

  const searchQueriesSet = useSelector(selectProjectMemberQueries);

  const cardSlotsFronts = [];
  const cardSlotsBacks = [];
  const projectMembers = useSelector(selectProjectMembers);
  const searchSettings = useSelector(
    (state: RootState) => state.searchSettings
  );
  const stringifiedSearchSettings = useMemo<string>(
    () => JSON.stringify(searchSettings),
    [searchSettings]
  );
  const stringifiedSources = JSON.stringify(
    searchSettings.sourceSettings.sources
  );

  const stringifiedSearchQueries = useMemo<string>(() => {
    const searchQueriesArray = Array.from(searchQueriesSet);
    searchQueriesArray.sort();
    return JSON.stringify(searchQueriesArray);
  }, [projectMembers]);

  useEffect(() => {
    if (searchSettings.sourceSettings.sources != null) {
      dispatch(fetchCardDocuments());
    }
  }, [stringifiedSearchQueries, stringifiedSources]);

  useEffect(() => {
    // recalculate search results when search settings change
    if (searchSettings.sourceSettings.sources != null) {
      dispatch(clearSearchResults());
      dispatch(fetchCardDocuments());
    }
  }, [stringifiedSearchSettings]);

  for (const [slot, slotProjectMember] of projectMembers.entries()) {
    cardSlotsFronts.push(
      <MemoizedCardSlot
        key={`${Front}-slot${slot}`}
        searchQuery={slotProjectMember.front?.query}
        face={Front}
        slot={slot}
        handleShowDetailedView={handleShowDetailedView}
      ></MemoizedCardSlot>
    );
    cardSlotsBacks.push(
      <MemoizedCardSlot
        key={`${Back}-slot${slot}`}
        searchQuery={slotProjectMember.back?.query}
        face={Back}
        slot={slot}
        handleShowDetailedView={handleShowDetailedView}
      ></MemoizedCardSlot>
    );
  }

  const frontsVisible = useSelector(
    (state: RootState) => state.viewSettings.frontsVisible
  );

  // TODO: should we aim to lift state up here and conditionally render rather than hide?
  return (
    <>
      <Row
        xxl={4}
        lg={3}
        md={2}
        sm={1}
        xs={1}
        className="g-0"
        style={{ display: frontsVisible ? "" : "none" }}
      >
        {cardSlotsFronts}
      </Row>
      <Row
        xxl={4}
        lg={3}
        md={2}
        sm={1}
        xs={1}
        className="g-0"
        style={{ display: frontsVisible ? "none" : "" }}
      >
        {cardSlotsBacks}
      </Row>
      <Modal show={!searchResultsIdle}>
        <Modal.Header closeButton>
          <Modal.Title>Loading...</Modal.Title>
        </Modal.Header>
        <Modal.Body>TODO</Modal.Body>
      </Modal>

      {detailedViewSelectedImage != null && (
        <MemoizedCardDetailedView
          imageIdentifier={detailedViewSelectedImage}
          show={showDetailedView}
          handleClose={handleCloseDetailedView}
        />
      )}
    </>
  );
}
