/**
 * A higher-level wrapper for the `Card` component with additional functionality.
 * Card slots allow modifying the selected image for the given slot number and face,
 * both via previous/next arrows and the grid selector. Clicking the selected image
 * displays the detailed view. Card slots can be deleted, which also deletes the
 * card slot for the same slot number in the other face.
 */

import React, { memo, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";

import { Back } from "@/common/constants";
import {
  Faces,
  SearchQuery,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { wrapIndex } from "@/common/utils";
import { MemoizedEditorCard } from "@/features/card/card";
import { selectCardbacks } from "@/features/card/cardbackSlice";
import { GridSelectorModal } from "@/features/modals/gridSelectorModal";
import { setSelectedSlotsAndShowModal } from "@/features/modals/modalsSlice";
import {
  bulkAlignMemberSelection,
  deleteSlot,
  selectProjectCardback,
  selectProjectMember,
  setSelectedImage,
  toggleMemberSelection,
} from "@/features/project/projectSlice";
import { selectSearchResultsForQueryOrDefault } from "@/features/search/searchResultsSlice";

interface CardSlotProps {
  searchQuery: SearchQuery | undefined;
  face: Faces;
  slot: number;
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
  const dispatch = useAppDispatch();
  function setSelectedImageFromIdentifier(selectedImage: string): void {
    dispatch(setSelectedImage({ face, slot, selectedImage }));
  }
  return (
    <GridSelectorModal
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

export function CardSlot({ searchQuery, face, slot }: CardSlotProps) {
  const [showGridSelector, setShowGridSelector] = useState<boolean>(false);

  const handleCloseGridSelector = () => setShowGridSelector(false);
  const handleShowGridSelector = () => setShowGridSelector(true);

  const dispatch = useAppDispatch();

  const cardbacks = useAppSelector(selectCardbacks);
  const projectCardback = useAppSelector(selectProjectCardback);
  const searchResultsForQueryOrDefault = useAppSelector((state) =>
    selectSearchResultsForQueryOrDefault(state, searchQuery, face, cardbacks)
  );
  const projectMember = useAppSelector((state) =>
    selectProjectMember(state, slot, face)
  );
  const selectedImage = projectMember?.selectedImage;

  const handleShowChangeSelectedImageQueriesModal = () => {
    dispatch(setSelectedSlotsAndShowModal([[[face, slot]], "changeQuery"]));
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
        if (searchQuery?.query != null) {
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
  }, [
    dispatch,
    face,
    slot,
    searchQuery?.query,
    searchResultsForQueryOrDefault,
    projectCardback,
    selectedImage,
  ]);

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
      <MemoizedEditorCard
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
        cardHeaderTitle={cardHeaderTitle}
        cardFooter={cardFooter}
        cardHeaderButtons={cardHeaderButtons}
        searchQuery={searchQuery}
        nameOnClick={handleShowChangeSelectedImageQueriesModal}
        noResultsFound={
          searchResultsForQueryOrDefault != null &&
          searchResultsForQueryOrDefault.length === 0
        }
      />

      {searchResultsForQuery.length > 1 && showGridSelector && (
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
