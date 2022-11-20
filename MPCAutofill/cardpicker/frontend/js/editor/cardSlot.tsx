import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "./store";
import { Card } from "./card";
import { Faces, SearchQuery } from "./constants";
import { wrapIndex } from "./utils";
import { setSelectedImage } from "./projectSlice";

// import styles from './Counter.module.css'

interface CardSlotProps {
  searchQuery: SearchQuery;
  face: Faces;
  slot: number;
  selectedImage?: string;
}

export function CardSlot(props: CardSlotProps) {
  const searchQuery: SearchQuery = props.searchQuery;
  const face = props.face;
  const slot = props.slot;
  let selectedImage = props.selectedImage;

  const dispatch = useDispatch<AppDispatch>();

  const searchResultsForQuery = useSelector(
    (state: RootState) =>
      (state.searchResults.searchResults[searchQuery.query] ?? {})[
        searchQuery.card_type
      ] ?? []
  ); // TODO: move this selector into searchResultsSlice

  useEffect(() => {
    // If no image is selected and there are search results, select the first image in search results
    if (
      (searchResultsForQuery.length > 0 && selectedImage === null) ||
      selectedImage === undefined
    ) {
      dispatch(
        setSelectedImage({
          face,
          slot,
          selectedImage: searchResultsForQuery[0],
        })
      );
    }
  }, [searchResultsForQuery]);

  const selectedImageIndex = searchResultsForQuery.indexOf(selectedImage);
  const previousImage =
    searchResultsForQuery[
      wrapIndex(selectedImageIndex + 1, searchResultsForQuery.length)
    ];
  const nextImage =
    searchResultsForQuery[
      wrapIndex(selectedImageIndex - 1, searchResultsForQuery.length)
    ];

  function setSelectedImageFromDelta(delta: number): void {
    // TODO: docstring
    dispatch(
      setSelectedImage({
        face,
        slot,
        selectedImage:
          searchResultsForQuery[
            wrapIndex(selectedImageIndex + delta, searchResultsForQuery.length)
          ],
      })
    );
  }

  return (
    // style={{opacity: 0}}
    <div className="card mpccard mpccard-hover">
      <div className="card-header pb-0 text-center">
        <p className="mpccard-slot">Slot {slot + 1}</p>
        <button className="padlock">
          <i className="bi bi-unlock"></i>
        </button>
        <button className="remove">
          <i className="bi bi-x-circle"></i>
        </button>
      </div>
      <Card
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
      ></Card>
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
