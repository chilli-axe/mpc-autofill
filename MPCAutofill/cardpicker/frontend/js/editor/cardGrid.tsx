import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
// import { decrement, increment } from './cardSlotSlice'
import { RootState, AppDispatch } from "./store";
import { CardSlot } from "./cardSlot";
import { addSearchResults, fetchCards } from "./searchResultsSlice";
// import styles from './Counter.module.css'

export function CardGrid() {
  // const selectedImage = useSelector((state: RootState) => state.cardSlot.selectedImage)
  // const face = useSelector((state: RootState) => state.cardSlot.face)
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchCards());
  }, [dispatch]);

  return (
    <div
      id="card-container"
      className="row g-0 row-cols-xxl-4 row-cols-lg-3 row-cols-md-2 row-cols-sm-1 row-cols-1"
    >
      <CardSlot></CardSlot>
      <CardSlot></CardSlot>
      <CardSlot></CardSlot>
    </div>
  );
}
