/**
 * This component displays all `CardSlot`s in the project and is responsible for
 * querying the server for search results as necessary.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { useDispatch, useSelector } from "react-redux";
import { ThunkDispatch } from "redux-thunk";
import styled from "styled-components";

import { AppDispatch, RootState } from "@/app/store";
import { Back, Front } from "@/common/constants";
import { MemoizedCardDetailedView } from "@/features/card/cardDetailedView";
import { MemoizedCardSlot } from "@/features/card/cardSlot";
import {
  selectProjectMemberQueries,
  selectProjectMembers,
} from "@/features/project/projectSlice";
import { fetchCardDocuments } from "@/features/search/cardDocumentsSlice";
import { clearSearchResults } from "@/features/search/searchResultsSlice";

const CardGridDefaultBackground = styled.div`
  position: absolute;
  border: 1px darkgray solid;
  border-radius: 10px;
  height: 100%;
  width: 100%;
  box-shadow: 0 0 50px 0 black inset;
`;

const CardGridDefaultText = styled.div`
  position: relative;
  font-size: 1.25em;
  text-align: center;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-shadow: 0 4px 15px #000000;
  max-width: 90%;
`;

function CardGridDefault() {
  return (
    <CardGridDefaultBackground>
      <CardGridDefaultText>
        <p>Your project is empty at the moment.</p>
        <p>
          Use the <b>Add Cards</b> menu on the right to get started!
        </p>
      </CardGridDefaultText>
    </CardGridDefaultBackground>
  );
}

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
      {projectMembers.length == 0 && <CardGridDefault />}
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
