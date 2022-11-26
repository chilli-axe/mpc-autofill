import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "./store";
import { CardSlot } from "./cardSlot";
import { fetchCardDocuments } from "./cardDocumentsSlice";
import { Front, Back } from "./constants";
import Row from "react-bootstrap/Row";

// import styles from './Counter.module.css'

export function CardGrid() {
  const dispatch = useDispatch<AppDispatch>();

  let cardSlotsFronts = [];
  let cardSlotsBacks = [];
  const projectMembers = useSelector(
    (state: RootState) => state.project.members
  );

  // retrieve cards from database when queries in the project change
  let searchQueries: Array<string> = [];
  useSelector((state: RootState) =>
    state.project.members.forEach((x) => {
      searchQueries.push(JSON.stringify(x.front.query));
      searchQueries.push(JSON.stringify(x.back.query));
    })
  );
  useEffect(() => {
    dispatch(fetchCardDocuments());
  }, [searchQueries]);

  for (const [slot, slotProjectMember] of projectMembers.entries()) {
    cardSlotsFronts.push(
      <CardSlot
        key={`${Front}-slot-${slot}`}
        searchQuery={slotProjectMember.front.query}
        face={Front}
        slot={slot}
        selectedImage={slotProjectMember.front.selectedImage}
      ></CardSlot>
    );
    cardSlotsBacks.push(
      <CardSlot
        key={`${Back}-slot-${slot}`}
        searchQuery={slotProjectMember.back.query}
        face={Back}
        slot={slot}
        selectedImage={slotProjectMember.back.selectedImage}
      ></CardSlot>
    );
  }

  return (
    <Row xxl={4} lg={3} md={2} sm={1} xs={1} className="g-0">
      {cardSlotsFronts}
    </Row>
  );
}
