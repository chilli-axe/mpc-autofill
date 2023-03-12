import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../../app/store";
import { CardSlot } from "./cardSlot";
import { fetchCardDocuments } from "../search/cardDocumentsSlice";
import { clearSearchResults } from "../search/searchResultsSlice";
import { Front, Back } from "../../common/constants";
import Row from "react-bootstrap/Row";
import { selectProjectMembers } from "../project/projectSlice";
import Modal from "react-bootstrap/Modal";

export function CardGrid() {
  const dispatch = useDispatch<AppDispatch>();

  // TODO: this doesn't work yet
  const searchResultsIdle = // TODO: replace the magic string here with a constant
    useSelector((state: RootState) => state.searchResults.status) === "idle";

  const cardSlotsFronts = [];
  const cardSlotsBacks = [];
  const projectMembers = useSelector(selectProjectMembers);
  const searchSettings = useSelector(
    (state: RootState) => state.searchSettings
  );
  const stringifiedSearchSettings = JSON.stringify(searchSettings);

  // retrieve cards from database when queries in the project change
  // TODO: I think this snippet should move somewhere more sensible & reusable. probably as a selector.
  const searchQueries: Set<string> = new Set();
  projectMembers.forEach((x) => {
    // TODO: does this implementation mean you wouldn't retrieve search results if you have `goblin` in the project and search for `t:goblin`?
    if (x.front != null && x.front.query != null) {
      searchQueries.add(JSON.stringify(x.front.query.query));
    }
    if (x.back != null && x.back.query != null) {
      searchQueries.add(JSON.stringify(x.back.query.query));
    }
  });
  const searchQueriesArray = Array.from(searchQueries);
  searchQueriesArray.sort();

  useEffect(() => {
    if (searchSettings.sourceSettings.sources != null) {
      dispatch(fetchCardDocuments());
    }
  }, [searchQueriesArray.join(",")]);

  useEffect(() => {
    // recalculate search results when search settings change
    if (searchSettings.sourceSettings.sources != null) {
      dispatch(clearSearchResults());
      dispatch(fetchCardDocuments());
    }
  }, [stringifiedSearchSettings]);

  for (const [slot, slotProjectMember] of projectMembers.entries()) {
    cardSlotsFronts.push(
      <CardSlot
        key={`${Front}-slot-${slot}`}
        searchQuery={
          slotProjectMember.front != null
            ? slotProjectMember.front.query
            : undefined
        }
        face={Front}
        slot={slot}
      ></CardSlot>
    );
    cardSlotsBacks.push(
      <CardSlot
        key={`${Back}-slot-${slot}`}
        searchQuery={
          slotProjectMember.back != null
            ? slotProjectMember.back.query
            : undefined
        }
        face={Back}
        slot={slot}
      ></CardSlot>
    );
  }

  const frontsVisible = useSelector(
    (state: RootState) => state.viewSettings.frontsVisible
  );

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
    </>
  );
}
