/**
 * A higher-level wrapper for the `Card` component with additional functionality.
 * Card slots allow modifying the selected image for the given slot number and face,
 * both via previous/next arrows and the grid selector. Clicking the selected image
 * displays the detailed view. Card slots can be deleted, which also deletes the
 * card slot for the same slot number in the other face.
 */

import React, { memo, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import { useDispatch, useSelector } from "react-redux";

import { AppDispatch, RootState } from "@/app/store";
import { Back } from "@/common/constants";
import { Faces, SearchQuery } from "@/common/types";
import { wrapIndex } from "@/common/utils";
import { MemoizedCard } from "@/features/card/card";
import { GridSelector } from "@/features/card/gridSelector";
import {
  bulkAlignMemberSelection,
  deleteSlot,
  setSelectedImage,
  toggleMemberSelection,
} from "@/features/project/projectSlice";

interface CardSlotProps {
  searchQuery: SearchQuery | undefined;
  face: Faces;
  slot: number;
  handleShowDetailedView: {
    (selectedImage: string): void;
  };
}

//# region grid selector

interface CardSlotGridSelectorProps {
  face: Faces;
  slot: number;
  searchResultsForQuery: Array<string>;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function CardSlotGridSelector({
  face,
  slot,
  searchResultsForQuery,
  show,
  handleClose,
}: CardSlotGridSelectorProps) {
  const dispatch = useDispatch<AppDispatch>();
  function setSelectedImageFromIdentifier(selectedImage: string): void {
    dispatch(setSelectedImage({ face, slot, selectedImage }));
  }
  return (
    <GridSelector
      testId={`${face}-slot${slot}-grid-selector`}
      imageIdentifiers={searchResultsForQuery}
      show={show}
      handleClose={handleClose}
      onClick={setSelectedImageFromIdentifier}
    />
  );
}

export const MemoizedCardSlotGridSelector = memo(CardSlotGridSelector);

//# endregion

//# region card slot

export function CardSlot({
  searchQuery,
  face,
  slot,
  handleShowDetailedView,
}: CardSlotProps) {
  const [showGridSelector, setShowGridSelector] = useState(false);

  const handleCloseGridSelector = () => setShowGridSelector(false);
  const handleShowGridSelector = () => setShowGridSelector(true);

  const dispatch = useDispatch<AppDispatch>();

  // TODO: move this selector into searchResultsSlice
  // this is a bit confusing. if the card has a query, use the query's results. if it's a cardback with no query,
  // display the common cardback's results.
  const cardbacks =
    useSelector((state: RootState) => state.cardbacks.cardbacks) ?? [];
  const projectCardback = useSelector(
    (state: RootState) => state.project.cardback
  );
  const searchResultsForQueryOrDefault = useSelector((state: RootState) =>
    searchQuery?.query != null
      ? (state.searchResults.searchResults[searchQuery.query] ?? {})[
          searchQuery.card_type
        ]
      : face === Back
      ? cardbacks
      : []
  );

  const projectMember = useSelector(
    (state: RootState) => (state.project.members[slot] ?? {})[face]
  );
  const selectedImage = projectMember?.selectedImage;

  const handleShowSelectedImageDetailedView = () => {
    if (selectedImage != null) {
      handleShowDetailedView(selectedImage);
    }
  };

  useEffect(() => {
    /**
     * Set the selected image according to some initialisation logic (if search results have loaded).
     */

    if (searchResultsForQueryOrDefault != null) {
      let mutatedSelectedImage = selectedImage;

      // If an image is selected and it's not in the search results, deselect the image
      if (
        mutatedSelectedImage != null &&
        !searchResultsForQueryOrDefault.includes(mutatedSelectedImage)
      ) {
        mutatedSelectedImage = undefined;
      }

      // If no image is selected and there are search results, select the first image in search results
      if (
        searchResultsForQueryOrDefault.length > 0 &&
        mutatedSelectedImage == null
      ) {
        if (searchQuery != null) {
          mutatedSelectedImage = searchResultsForQueryOrDefault[0];
        } else if (face === Back && projectCardback != null) {
          mutatedSelectedImage = projectCardback;
        }
      }

      dispatch(
        setSelectedImage({
          face,
          slot,
          selectedImage: mutatedSelectedImage,
        })
      );
    }
  }, [searchResultsForQueryOrDefault, projectCardback]);

  // const selectedImage = useSelector((state: RootState) => (state.project.members[slot] != null ? (state.project.members[slot][face] != null ? state.project.members[slot][face].selectedImage : null) : null))

  const searchResultsForQuery = searchResultsForQueryOrDefault ?? [];
  const selectedImageIndex: number | undefined =
    selectedImage != null
      ? searchResultsForQuery.indexOf(selectedImage)
      : undefined;
  const previousImage: string | undefined =
    selectedImageIndex != null
      ? searchResultsForQuery[
          wrapIndex(selectedImageIndex + 1, searchResultsForQuery.length)
        ]
      : undefined;
  const nextImage: string | undefined =
    selectedImageIndex != null
      ? searchResultsForQuery[
          wrapIndex(selectedImageIndex - 1, searchResultsForQuery.length)
        ]
      : undefined;

  // TODO: add a confirmation prompt here. yes/no/yes and don't ask again.
  const deleteThisSlot = () => {
    dispatch(deleteSlot({ slot }));
  };

  const toggleSelectionForThisMember = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (event.detail == 2) {
      // double-click
      dispatch(bulkAlignMemberSelection({ slot, face }));
    } else {
      dispatch(toggleMemberSelection({ slot, face }));
    }
  };

  function setSelectedImageFromDelta(delta: number): void {
    // TODO: docstring
    if (selectedImageIndex != null) {
      dispatch(
        setSelectedImage({
          face,
          slot,
          selectedImage:
            searchResultsForQuery[
              wrapIndex(
                selectedImageIndex + delta,
                searchResultsForQuery.length
              )
            ],
        })
      );
    }
  }

  const cardHeaderTitle = `Slot ${slot + 1}`;
  const cardHeaderButtons = (
    <>
      <button
        className="card-select"
        onClick={toggleSelectionForThisMember}
        aria-label={`select-${face}${slot}`}
      >
        <i
          className={`bi bi${
            projectMember?.selected ?? false ? "-check" : ""
          }-square`}
        ></i>
      </button>
      <button className="remove">
        <i
          className="bi bi-x-circle"
          onClick={deleteThisSlot}
          aria-label={`remove-${face}${slot}`}
        ></i>
      </button>
    </>
  );
  const cardFooter = (
    <>
      {searchResultsForQuery.length === 1 && (
        <p className="mpccard-counter text-center align-middle">
          1 / {searchResultsForQuery.length}
        </p>
      )}
      {searchResultsForQuery.length > 1 && (
        <>
          <Button
            variant="outline-info"
            className="mpccard-counter-btn"
            onClick={handleShowGridSelector}
          >
            {(selectedImageIndex ?? 0) + 1} / {searchResultsForQuery.length}
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
    <div
      style={{ contentVisibility: "auto" }}
      data-testid={`${face}-slot${slot}`}
    >
      <MemoizedCard
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
        cardHeaderTitle={cardHeaderTitle}
        cardFooter={cardFooter}
        cardHeaderButtons={cardHeaderButtons}
        imageOnClick={handleShowSelectedImageDetailedView}
        searchQuery={searchQuery}
        noResultsFound={
          searchResultsForQueryOrDefault != null &&
          searchResultsForQueryOrDefault.length === 0
        }
      />

      {searchResultsForQuery.length > 1 && (
        <MemoizedCardSlotGridSelector
          face={face}
          slot={slot}
          searchResultsForQuery={searchResultsForQuery}
          show={showGridSelector}
          handleClose={handleCloseGridSelector}
        />
      )}
    </div>
  );
}

export const MemoizedCardSlot = memo(CardSlot);

//# endregion
