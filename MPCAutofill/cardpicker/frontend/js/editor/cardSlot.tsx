import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";
import { Card } from "./card";
import { Faces, SearchQuery } from "./constants";
import { wrapIndex } from "./utils";
import { Root } from "react-dom/client";

// import styles from './Counter.module.css'

interface CardSlotProps {
  searchQuery: SearchQuery;
  face: Faces;
  slot: number;
}

export function CardSlot(props: CardSlotProps) {
  const searchQuery: SearchQuery = props.searchQuery;
  const face = props.face;
  const slot = props.slot;
  const [selectedImage, setSelectedImage] = useState(null);

  const searchResultsForQuery = useSelector(
    (state: RootState) =>
      (state.searchResults.searchResults[searchQuery.query] ?? {})[
        searchQuery.card_type
      ] ?? []
  ); // TODO: move this selector into searchResultsSlice
  if (searchResultsForQuery.length > 0 && selectedImage === null) {
    setSelectedImage(searchResultsForQuery[0]);
  }

  const selectedImageIndex = searchResultsForQuery.indexOf(selectedImage);

  function setSelectedImageFromDelta(delta: number): void {
    // TODO: docstring
    setSelectedImage(
      searchResultsForQuery[
        wrapIndex(selectedImageIndex + delta, searchResultsForQuery.length)
      ]
    );
  }

  return (
    // style={{opacity: 0}}
    <div className="card mpccard">
      <div className="card-header pb-0 text-center">
        <p className="mpccard-slot">Slot {slot + 1}</p>
        <button className="padlock">
          <i className="bi bi-unlock"></i>
        </button>
        <button className="remove">
          <i className="bi bi-x-circle"></i>
        </button>
      </div>
      <Card identifier={selectedImage}></Card>
      <div
        className="card-footer padding-top"
        style={{ paddingTop: 50 + "px" }}
      >
        <button className="card-text mpccard-counter-btn btn btn-outline-info">
          {selectedImageIndex + 1} / {searchResultsForQuery.length}
        </button>
        {searchResultsForQuery.length > 1 && (
          <div>
            <button
              className="prev btn btn-outline-primary"
              onClick={() => setSelectedImageFromDelta(-1)}
            >
              &#10094;
            </button>
            <button
              className="next btn btn-outline-primary"
              onClick={() => setSelectedImageFromDelta(1)}
            >
              &#10095;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
