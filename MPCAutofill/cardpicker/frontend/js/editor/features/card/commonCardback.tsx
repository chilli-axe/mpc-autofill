import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "../../app/store";
import { Card } from "./card";
import { Back } from "../../common/constants";
import { wrapIndex } from "../../common/utils";
import {
  setSelectedCardback,
  bulkSetSelectedImage,
} from "../project/projectSlice";
import Button from "react-bootstrap/Button";
import { CardDetailedView } from "./cardDetailedView";
import { CommonCardbackGridSelector } from "./gridSelector";

interface CommonCardbackProps {
  selectedImage?: string;
}

export function CommonCardback(props: CommonCardbackProps) {
  const dispatch = useDispatch<AppDispatch>();

  const selectedImage = props.selectedImage;

  const [showDetailedView, setShowDetailedView] = useState(false);
  const [showGridSelector, setShowGridSelector] = useState(false);

  const handleCloseDetailedView = () => setShowDetailedView(false);
  const handleShowDetailedView = () => setShowDetailedView(true);
  const handleCloseGridSelector = () => setShowGridSelector(false);
  const handleShowGridSelector = () => setShowGridSelector(true);

  // TODO: move this selector somewhere more sensible
  const searchResults = useSelector(
    (state: RootState) => state.cardbacks.cardbacks
  );

  // TODO
  useEffect(() => {
    // If no image is selected and there are cardbacks, select the first image in search results
    if (
      (searchResults.length > 0 && selectedImage === null) ||
      selectedImage === undefined
    ) {
      dispatch(
        setSelectedCardback({
          selectedImage: searchResults[0],
        })
      );
    }
  }, [searchResults]);

  const selectedImageIndex = searchResults.indexOf(selectedImage);
  const previousImage =
    searchResults[wrapIndex(selectedImageIndex + 1, searchResults.length)];
  const nextImage =
    searchResults[wrapIndex(selectedImageIndex - 1, searchResults.length)];

  function setSelectedImageFromDelta(delta: number): void {
    const newImage =
      searchResults[
        wrapIndex(selectedImageIndex + delta, searchResults.length)
      ];
    dispatch(
      bulkSetSelectedImage({
        currentImage: selectedImage,
        selectedImage: newImage,
        face: Back,
      })
    );
    dispatch(
      setSelectedCardback({
        selectedImage: newImage,
      })
    );
  }

  // TODO: would be good to reuse some of this code
  const cardHeaderTitle = "Cardback";
  const cardFooter = (
    <>
      {searchResults.length === 1 && (
        <p className="mpccard-counter text-center align-middle">
          1 / {searchResults.length}
        </p>
      )}
      {searchResults.length > 1 && (
        <>
          <Button
            variant="outline-info"
            className="mpccard-counter-btn"
            onClick={handleShowGridSelector}
          >
            {selectedImageIndex + 1} / {searchResults.length}
          </Button>
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
        </>
      )}
    </>
  );

  return (
    <>
      <Card
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
        cardHeaderTitle={cardHeaderTitle}
        cardFooter={cardFooter}
        imageOnClick={handleShowDetailedView}
        noResultsFound={false}
      />

      <CommonCardbackGridSelector
        searchResults={searchResults}
        show={showGridSelector}
        handleClose={handleCloseGridSelector}
      />
      <CardDetailedView
        imageIdentifier={selectedImage}
        show={showDetailedView}
        handleClose={handleCloseDetailedView}
      />
    </>
  );
}
