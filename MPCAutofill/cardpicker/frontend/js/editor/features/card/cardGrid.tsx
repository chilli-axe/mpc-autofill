import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../../app/store";
import { CardSlot } from "./cardSlot";
import { fetchCardDocuments } from "../search/cardDocumentsSlice";
import { clearSearchResults } from "../search/searchResultsSlice";
import { Front, Back } from "../../common/constants";
import Row from "react-bootstrap/Row";
import { selectProjectMembers } from "../project/projectSlice";

// import styles from './Counter.module.css'

export function CardGrid() {
  const dispatch = useDispatch<AppDispatch>();

  let cardSlotsFronts = [];
  let cardSlotsBacks = [];
  const projectMembers = useSelector(selectProjectMembers);
  const cardSources =
    useSelector((state: RootState) => state.searchSettings.cardSources) ?? [];

  // retrieve cards from database when queries in the project change
  // TODO: I think this snippet should move somewhere more sensible & reusable. probably as a selector.
  let searchQueries: Set<string> = new Set();
  projectMembers.forEach((x) => {
    if (x.front != null && x.front.query != null) {
      searchQueries.add(JSON.stringify(x.front.query.query));
    }
    if (x.back != null && x.back.query != null) {
      searchQueries.add(JSON.stringify(x.back.query.query));
    }
  });
  const searchQueriesArray = Array.from(searchQueries);
  searchQueriesArray.sort();

  // alert([searchQueriesArray.join(","), cardSources.join(",")])

  // TODO: this implementation is not correct. when card sources change, we want to recalculate search results,
  // but attempt to keep the same images selected. the current implementation does not attempt to reselect the same images.
  useEffect(() => {
    dispatch(fetchCardDocuments());
  }, [searchQueriesArray.join(","), cardSources.join(",")]);

  useEffect(() => {
    // recalculate search results when sources change
    dispatch(clearSearchResults());
    dispatch(fetchCardDocuments());
  }, [cardSources.join(",")]);

  for (const [slot, slotProjectMember] of projectMembers.entries()) {
    cardSlotsFronts.push(
      <CardSlot
        key={`${Front}-slot-${slot}`}
        searchQuery={
          slotProjectMember.front != null ? slotProjectMember.front.query : null
        }
        face={Front}
        slot={slot}
      ></CardSlot>
    );
    cardSlotsBacks.push(
      <CardSlot
        key={`${Back}-slot-${slot}`}
        searchQuery={
          slotProjectMember.back != null ? slotProjectMember.back.query : null
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
    </>
  );
}
