import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "./store";
import { CardSlot } from "./cardSlot";
import { fetchCardDocuments } from "./cardDocumentsSlice";
import { Front, Back } from "./constants";
import Row from "react-bootstrap/Row";
import { selectProjectMembers } from "./projectSlice";

// import styles from './Counter.module.css'

export function CardGrid() {
  const dispatch = useDispatch<AppDispatch>();

  let cardSlotsFronts = [];
  let cardSlotsBacks = [];
  const projectMembers = useSelector(selectProjectMembers);

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
  useEffect(() => {
    dispatch(fetchCardDocuments());
  }, [searchQueriesArray.join(",")]);

  for (const [slot, slotProjectMember] of projectMembers.entries()) {
    cardSlotsFronts.push(
      <CardSlot
        key={`${Front}-slot-${slot}`}
        searchQuery={
          slotProjectMember.front != null ? slotProjectMember.front.query : null
        }
        face={Front}
        slot={slot}
        selectedImage={
          slotProjectMember.front != null
            ? slotProjectMember.front.selectedImage
            : null
        }
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
        selectedImage={
          slotProjectMember.back != null
            ? slotProjectMember.back.selectedImage
            : null
        }
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
