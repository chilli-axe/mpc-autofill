/**
 * A higher-level wrapper for the `Card` component with additional functionality.
 * Similar to the `CardSlot` component, but tailored specifically for use with
 * the project cardback (displayed in the right panel of the project editor).
 */

import React, { memo, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";

import { Back } from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { wrapIndex } from "@/common/utils";
import { MemoizedEditorCard } from "@/features/card/card";
import { selectCardbacks } from "@/features/card/cardbackSlice";
import { GridSelectorModal } from "@/features/modals/gridSelectorModal";
import {
  bulkReplaceSelectedImage,
  selectProjectCardback,
  setSelectedCardback,
} from "@/features/project/projectSlice";

//# region grid selector

interface CommonCardbackGridSelectorProps {
  searchResults: Array<string>;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function CommonCardbackGridSelector({
  searchResults,
  show,
  handleClose,
}: CommonCardbackGridSelectorProps) {
  const projectCardback = useAppSelector(selectProjectCardback);
  const dispatch = useAppDispatch();
  function setSelectedImageFromIdentifier(selectedImage: string): void {
    if (projectCardback != null) {
      dispatch(
        bulkReplaceSelectedImage({
          currentImage: projectCardback,
          selectedImage,
          face: Back,
        })
      );
      dispatch(setSelectedCardback({ selectedImage }));
    }
  }
  return (
    <GridSelectorModal
      testId="cardback-grid-selector"
      imageIdentifiers={searchResults}
      show={show}
      handleClose={handleClose}
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

export function CommonCardback({ selectedImage }: CommonCardbackProps) {
  const dispatch = useAppDispatch();

  const [showGridSelector, setShowGridSelector] = useState<boolean>(false);
  const handleCloseGridSelector = () => setShowGridSelector(false);
  const handleShowGridSelector = () => setShowGridSelector(true);

  const searchResults = useAppSelector(selectCardbacks);

  // TODO: avoid repeating this logic between this component and cardSlot
  useEffect(() => {
    let mutatedSelectedImage = selectedImage;

    // If an image is selected and it's not in the search results, deselect the image
    if (
      mutatedSelectedImage != null &&
      !searchResults.includes(mutatedSelectedImage)
    ) {
      mutatedSelectedImage = undefined;
    }

    // If no image is selected and there are cardbacks, select the first image in search results
    if (searchResults.length > 0 && mutatedSelectedImage == null) {
      mutatedSelectedImage = searchResults[0];
    }

    dispatch(
      setSelectedCardback({
        selectedImage: mutatedSelectedImage ?? null,
      })
    );
  }, [dispatch, selectedImage, searchResults]);

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
        bulkReplaceSelectedImage({
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
      <MemoizedEditorCard
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
        cardHeaderTitle={cardHeaderTitle}
        cardFooter={cardFooter}
        noResultsFound={searchResults.length === 0}
      />
      {showGridSelector && (
        <MemoizedCommonCardbackGridSelector
          searchResults={searchResults}
          show={showGridSelector}
          handleClose={handleCloseGridSelector}
        />
      )}
    </div>
  );
}

//# endregion
