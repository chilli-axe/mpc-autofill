import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
// import { decrement, increment } from './cardSlotSlice'
import { RootState, AppDispatch } from "./store";
import { CardSlot } from "./cardSlot";
import { addSearchResults, fetchCards } from "./searchResultsSlice";
import { fetchCardDocuments } from "./cardDocumentsSlice";
import { Faces, Front, Back } from "./constants";

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
        searchQuery={projectMember.front.query}
        face={Front}
        slot={parseInt(slot)} // TODO: this sucks a bit
        selectedImage={projectMember.front.selectedImage}
      ></CardSlot>
    );
    cardSlotsBacks.push(
      <CardSlot
        searchQuery={projectMember.back.query}
        face={Back}
        slot={parseInt(slot)} // TODO: this sucks a bit
        selectedImage={projectMember.back.selectedImage}
      ></CardSlot>
    );
  }

  return (
    <div className="row g-0 row-cols-xxl-4 row-cols-lg-3 row-cols-md-2 row-cols-sm-1 row-cols-1">
      {cardSlotsFronts}
    </div>
  );
}
