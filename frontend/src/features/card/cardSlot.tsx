/**
 * A higher-level wrapper for the `Card` component with additional functionality.
 * Card slots allow modifying the selected image for the given slot number and face,
 * both via previous/next arrows and the grid selector. Clicking the selected image
 * displays the detailed view. Card slots can be deleted, which also deletes the
 * card slot for the same slot number in the other face.
 */

import React, { memo, useState } from "react";
import Button from "react-bootstrap/Button";

import {
  Faces,
  SearchQuery,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { wrapIndex } from "@/common/utils";
import { MemoizedEditorCard } from "@/features/card/card";
import { selectCardbacks } from "@/features/card/cardbackSlice";
import { GridSelectorModal } from "@/features/gridSelector/gridSelectorModal";
import { setSelectedSlotsAndShowModal } from "@/features/modals/modalsSlice";
import {
  bulkAlignMemberSelection,
  deleteSlots,
  selectAllSelectedProjectMembersHaveTheSameQuery,
  selectProjectMember,
  selectSelectedSlots,
  setSelectedImages,
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
  selectedImage?: string;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
  setSelectedImageFromIdentifier: {
    (selectedImage: string): void;
  };
}

export function CardSlotGridSelector({
  face,
  slot,
  searchResultsForQuery,
  selectedImage,
  show,
  handleClose,
  setSelectedImageFromIdentifier,
}: CardSlotGridSelectorProps) {
  return (
    <GridSelectorModal
      testId={`${face}-slot${slot}-grid-selector`}
      imageIdentifiers={searchResultsForQuery}
      selectedImage={selectedImage}
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
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const cardbacks = useAppSelector(selectCardbacks);
  const searchResultsForQueryOrDefault = useAppSelector((state) =>
    selectSearchResultsForQueryOrDefault(state, searchQuery, face, cardbacks)
  );
  const projectMember = useAppSelector((state) =>
    selectProjectMember(state, slot, face)
  );
  const selectedImage = projectMember?.selectedImage;
  const selectedSlots = useAppSelector(selectSelectedSlots);
  const selectedQuery = useAppSelector((state) =>
    selectAllSelectedProjectMembersHaveTheSameQuery(state, selectedSlots)
  );
  const modifySelectedSlots =
    selectedSlots.length > 1 &&
    projectMember?.selected &&
    selectedQuery != null &&
    // can't use object equality check here
    selectedQuery.query === searchQuery?.query &&
    selectedQuery.card_type === searchQuery?.card_type;
  const slotsToModify: Array<[Faces, number]> = modifySelectedSlots
    ? selectedSlots
    : [[face, slot]];

  //# endregion

  //# region state

  const [showGridSelector, setShowGridSelector] = useState<boolean>(false);

  //# endregion

  //# region callbacks

  const handleCloseGridSelector = () => setShowGridSelector(false);
  const handleShowGridSelector = () => setShowGridSelector(true);
  const handleShowChangeSelectedImageQueriesModal = () => {
    dispatch(setSelectedSlotsAndShowModal([[[face, slot]], "changeQuery"]));
  };
  // TODO: add a confirmation prompt here. yes/no/yes and don't ask again.
  const deleteThisSlot = () => {
    dispatch(deleteSlots({ slots: [slot] }));
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
  const setSelectedImageFromDelta = (delta: number): void => {
    // TODO: docstring
    if (selectedImageIndex != null) {
      dispatch(
        setSelectedImages({
          slots: slotsToModify,
          selectedImage:
            searchResultsForQuery[
              wrapIndex(
                selectedImageIndex + delta,
                searchResultsForQuery.length
              )
            ],
          deselect: false,
        })
      );
    }
  };
  const setSelectedImageFromIdentifier = (selectedImage: string) => {
    dispatch(
      setSelectedImages({
        slots: slotsToModify,
        selectedImage,
        deselect: false,
      })
    );
  };

  //# endregion

  //# region computed constants

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
          aria-label={`${face}${slot}-${
            projectMember?.selected ?? false ? "" : "un"
          }checked`}
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
            variant={modifySelectedSlots ? "info" : "outline-info"}
            className="mpccard-counter-btn"
            onClick={handleShowGridSelector}
          >
            {(selectedImageIndex ?? 0) + 1} / {searchResultsForQuery.length}
          </Button>
          <div>
            <Button
              variant={modifySelectedSlots ? "info" : "outline-info"}
              className="prev"
              onClick={() => setSelectedImageFromDelta(-1)}
            >
              &#10094;
            </Button>
            <Button
              variant={modifySelectedSlots ? "info" : "outline-info"}
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

  //# endregion

  return (
    <div data-testid={`${face}-slot${slot}`}>
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
          selectedImage={selectedImage}
          show={showGridSelector}
          handleClose={handleCloseGridSelector}
          setSelectedImageFromIdentifier={setSelectedImageFromIdentifier}
        />
      )}
    </div>
  );
}

export const MemoizedCardSlot = memo(CardSlot);

//# endregion
