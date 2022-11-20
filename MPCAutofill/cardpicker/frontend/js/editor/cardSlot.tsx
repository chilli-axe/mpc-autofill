import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "./store";
import { Card } from "./card";
import { Faces, SearchQuery } from "./constants";
import { wrapIndex } from "./utils";
import { setSelectedImage } from "./projectSlice";
import BSCard from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";

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
    <BSCard className="mpccard mpccard-hover">
      <BSCard.Header className="pb-0 text-center">
        <p className="mpccard-slot">Slot {slot + 1}</p>
        <button className="padlock">
          <i className="bi bi-unlock"></i>
        </button>
        <button className="remove">
          <i className="bi bi-x-circle"></i>
        </button>
      </BSCard.Header>
      <Card
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
      ></Card>
      <BSCard.Footer className="padding-top" style={{ paddingTop: 50 + "px" }}>
        <Button variant="outline-info" className="mpccard-counter-btn">
          {selectedImageIndex + 1} / {searchResultsForQuery.length}
        </Button>
        {searchResultsForQuery.length > 1 && (
          <div>
            <Button
              variant="outline-primary"
              className="prev"
              onClick={() => setSelectedImageFromDelta(-1)}
            >
              &#10094;
            </Button>
            <Button
              variant="outline-primary"
              className="next"
              onClick={() => setSelectedImageFromDelta(1)}
            >
              &#10095;
            </Button>
          </div>
        )}
      </BSCard.Footer>
    </BSCard>
  );
}
