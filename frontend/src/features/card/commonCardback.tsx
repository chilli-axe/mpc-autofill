/**
 * A higher-level wrapper for the `Card` component with additional functionality.
 * Similar to the `CardSlot` component, but tailored specifically for use with
 * the project cardback (displayed in the right panel of the project editor).
 */

import React, { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/app/store";
import { MemoizedCard } from "./card";
import { Back } from "@/common/constants";
import { wrapIndex } from "@/common/utils";
import {
  setSelectedCardback,
  bulkSetSelectedImage,
} from "../project/projectSlice";
import Button from "react-bootstrap/Button";
import { MemoizedCardDetailedView } from "./cardDetailedView";
import { GridSelector } from "./gridSelector";

//# region grid selector

interface CommonCardbackGridSelectorProps {
  searchResults: Array<string>;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function CommonCardbackGridSelector(
  props: CommonCardbackGridSelectorProps
) {
  const projectCardback = useSelector(
    (state: RootState) => state.project.cardback
  );
  const dispatch = useDispatch<AppDispatch>();
  function setSelectedImageFromIdentifier(selectedImage: string): void {
    if (projectCardback != null) {
      dispatch(
        bulkSetSelectedImage({
          currentImage: projectCardback,
          selectedImage,
          face: Back,
        })
      );
      dispatch(setSelectedCardback({ selectedImage }));
    }
  }
  return (
    <GridSelector
      testId="cardback-grid-selector"
      imageIdentifiers={props.searchResults}
      show={props.show}
      handleClose={props.handleClose}
      onClick={setSelectedImageFromIdentifier}
    />
  );
}

export const MemoizedCommonCardbackGridSelector = memo(
  CommonCardbackGridSelector
);

//# endregion

//# region common cardback

interface CommonCardbackProps {
  selectedImage: string | undefined;
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
    if (searchResults.length > 0 && selectedImage == null) {
      dispatch(
        setSelectedCardback({
          selectedImage: searchResults[0],
        })
      );
    }
  }, [searchResults]);

  const selectedImageIndex: number | undefined =
    selectedImage != null ? searchResults.indexOf(selectedImage) : undefined;
  const previousImage: string | undefined =
    selectedImageIndex != null
      ? searchResults[wrapIndex(selectedImageIndex + 1, searchResults.length)]
      : undefined;
  const nextImage: string | undefined =
    selectedImageIndex != null
      ? searchResults[wrapIndex(selectedImageIndex - 1, searchResults.length)]
      : undefined;

  function setSelectedImageFromDelta(delta: number): void {
    if (selectedImage != null && selectedImageIndex != null) {
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
            {(selectedImageIndex ?? 0) + 1} / {searchResults.length}
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
    <div data-testid="common-cardback">
      <MemoizedCard
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
        cardHeaderTitle={cardHeaderTitle}
        cardFooter={cardFooter}
        imageOnClick={handleShowDetailedView}
        noResultsFound={false}
      />

      <MemoizedCommonCardbackGridSelector
        searchResults={searchResults}
        show={showGridSelector}
        handleClose={handleCloseGridSelector}
      />
      {selectedImage != null && (
        <MemoizedCardDetailedView
          imageIdentifier={selectedImage}
          show={showDetailedView}
          handleClose={handleCloseDetailedView}
        />
      )}
    </div>
  );
}

//# endregion
