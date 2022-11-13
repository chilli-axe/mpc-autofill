import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
// import { decrement, increment } from './cardSlotSlice'
import { RootState, AppDispatch } from "./store";
import { CardSlot } from "./cardSlot";
import { addSearchResults, fetchCards } from "./searchResultsSlice";
import { fetchCardDocuments } from "./cardDocumentsSlice";
import { SearchQuery, CardTypes, Faces } from "./constants";

// import styles from './Counter.module.css'

export function CardGrid() {
  // const selectedImage = useSelector((state: RootState) => state.cardSlot.selectedImage)
  // const face = useSelector((state: RootState) => state.cardSlot.face)
  const dispatch = useDispatch<AppDispatch>();
  // TODO: it may be worthwhile to move card face up to this level and have two CardGrid instances

  useEffect(() => {
    dispatch(fetchCards());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchCardDocuments());
  }, [dispatch]);

  return (
    <div
      id="card-container"
      className="row g-0 row-cols-xxl-4 row-cols-lg-3 row-cols-md-2 row-cols-sm-1 row-cols-1"
    >
      <CardSlot
        searchQuery={
          { query: "island", card_type: CardTypes.Card } as SearchQuery
        }
        face={Faces.Front}
        slot={0}
      ></CardSlot>
      <CardSlot
        searchQuery={
          { query: "past in flames", card_type: CardTypes.Card } as SearchQuery
        }
        face={Faces.Front}
        slot={1}
      ></CardSlot>
      <CardSlot
        searchQuery={
          { query: "past in flames", card_type: CardTypes.Card } as SearchQuery
        }
        face={Faces.Front}
        slot={2}
      ></CardSlot>
    </div>
  );
}
