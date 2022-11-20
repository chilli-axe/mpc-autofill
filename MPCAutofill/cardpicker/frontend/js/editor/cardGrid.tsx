import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "./store";
import { CardSlot } from "./cardSlot";
import { addSearchResults, fetchCards } from "./searchResultsSlice";
import { fetchCardDocuments } from "./cardDocumentsSlice";
import { Faces, Front, Back } from "./constants";
import Row from "react-bootstrap/Row";

// import styles from './Counter.module.css'

export function CardGrid() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchCards());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchCardDocuments());
  }, [dispatch]);

  let cardSlotsFronts = [];
  let cardSlotsBacks = [];
  const project = useSelector((state: RootState) => state.project);

  for (const [slot, projectMember] of Object.entries(project)) {
    cardSlotsFronts.push(
      <CardSlot
        key={`${Front}-slot-${slot}`}
        searchQuery={projectMember.front.query}
        face={Front}
        slot={parseInt(slot)} // TODO: this sucks a bit
        selectedImage={projectMember.front.selectedImage}
      ></CardSlot>
    );
    cardSlotsBacks.push(
      <CardSlot
        key={`${Back}-slot-${slot}`}
        searchQuery={projectMember.back.query}
        face={Back}
        slot={parseInt(slot)} // TODO: this sucks a bit
        selectedImage={projectMember.back.selectedImage}
      ></CardSlot>
    );
  }

  return (
    <Row xxl={4} lg={3} md={2} sm={1} xs={1} className="g-0">
      {cardSlotsFronts}
    </Row>
  );
}
