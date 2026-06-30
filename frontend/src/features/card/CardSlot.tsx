/**
 * A higher-level wrapper for the `Card` component with additional functionality.
 * Card slots allow modifying the selected image for the given slot number and face,
 * both via previous/next arrows and the grid selector. Clicking the selected image
 * displays the detailed view. Card slots can be deleted, which also deletes the
 * card slot for the same slot number in the other face.
 */

import { useSortable } from "@dnd-kit/react/sortable";
import React, { memo, useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";

import {
  areSearchQueriesEqual,
  doesSearchQueryFilterOnPrinting,
} from "@/common/processing";
import {
  Faces,
  SearchQuery,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { wrapIndex } from "@/common/utils";
import { RightPaddedIcon } from "@/components/icon";
import { MemoizedEditorCard } from "@/features/card/Card";
import { CardFooter } from "@/features/card/CardFooter";
import { GridSelectorModal } from "@/features/gridSelector/GridSelectorModal";
import { showChangeQueryModal } from "@/store/slices/modalsSlice";
import {
  bulkAlignMemberSelection,
  bulkRemovePrintingFilter,
  deleteSlots,
  duplicateSlot,
  expandSelection,
  selectAllSelectedProjectMembersHaveTheSameQuery,
  selectProjectMember,
  selectSelectedSlots,
  setSelectedImages,
  toggleMemberSelection,
} from "@/store/slices/projectSlice";
import { selectSearchResultsForQueryOrDefault } from "@/store/slices/searchResultsSlice";

interface CardSlotProps {
  id: string;
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
  searchq?: string;
}

export function CardSlotGridSelector({
  face,
  slot,
  searchResultsForQuery,
  selectedImage,
  show,
  handleClose,
  setSelectedImageFromIdentifier,
  searchq,
}: CardSlotGridSelectorProps) {
  return (
    <GridSelectorModal
      testId={`${face}-slot${slot}-grid-selector`}
      imageIdentifiers={searchResultsForQuery}
      selectedImage={selectedImage}
      show={show}
      handleClose={handleClose}
      onClick={setSelectedImageFromIdentifier}
      searchq={searchq}
    />
  );
}

export const MemoizedCardSlotGridSelector = memo(CardSlotGridSelector);

//# endregion

const CardGridContextMenu = ({
  id,
  searchQuery,
  face,
  slot,
}: CardSlotProps) => {
  const dispatch = useAppDispatch();
  const handleShowChangeSelectedImageQueriesModal = () => {
    dispatch(
      showChangeQueryModal({
        slots: [[face, slot]],
        query: searchQuery?.query ?? null,
      })
    );
  };
  const deleteThisSlot = () => {
    dispatch(deleteSlots({ slots: [slot] }));
  };
  const removePrintingFilter = () => {
    dispatch(bulkRemovePrintingFilter({ slots: [[face, slot]] }));
  };
  const duplicateThisSlot = () => {
    dispatch(duplicateSlot({ slot: slot, quantity: 1 }));
  };
  return (
    <Dropdown className="card-context-menu" align="end">
      <Dropdown.Toggle variant="" data-testid="more-select-options">
        <i className="bi bi-three-dots" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item onClick={handleShowChangeSelectedImageQueriesModal}>
          <RightPaddedIcon bootstrapIconName="arrow-repeat" /> Change Query
        </Dropdown.Item>
        <Dropdown.Item onClick={duplicateThisSlot}>
          <RightPaddedIcon bootstrapIconName="copy" /> Duplicate
        </Dropdown.Item>
        {doesSearchQueryFilterOnPrinting(searchQuery) && (
          <Dropdown.Item onClick={removePrintingFilter}>
            <RightPaddedIcon bootstrapIconName="filter" /> Unfilter Printing
          </Dropdown.Item>
        )}
        <Dropdown.Item onClick={deleteThisSlot}>
          <RightPaddedIcon bootstrapIconName="x-circle" /> Delete
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
};

//# region card slot

export function CardSlot({ id, searchQuery, face, slot }: CardSlotProps) {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const { ref, handleRef, isDragging } = useSortable({ id, index: slot });
  const searchResultsForQueryOrDefault = useAppSelector((state) =>
    selectSearchResultsForQueryOrDefault(
      state,
      searchQuery?.query,
      searchQuery?.cardType,
      searchQuery?.expansionCode,
      searchQuery?.collectorNumber,
      face
    )
  );
  const projectMember = useAppSelector((state) =>
    selectProjectMember(state, face, slot)
  );
  const selectedImage = projectMember?.selectedImage;
  const selectedSlots = useAppSelector(selectSelectedSlots);
  const selectedQuery = useAppSelector((state) =>
    selectAllSelectedProjectMembersHaveTheSameQuery(state, selectedSlots)
  );
  const modifySelectedSlots =
    selectedSlots.length > 1 &&
    projectMember?.selected &&
    areSearchQueriesEqual(selectedQuery, searchQuery);
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
    let stringifiedSearchQuery: string | null = null;
    if (searchQuery?.query) {
      stringifiedSearchQuery = searchQuery.query;
      if (searchQuery.expansionCode) {
        stringifiedSearchQuery += ` (${searchQuery.expansionCode})`;
        if (searchQuery.collectorNumber) {
          stringifiedSearchQuery += ` ${searchQuery.collectorNumber}`;
        }
      }
    }
    dispatch(
      showChangeQueryModal({
        slots: [[face, slot]],
        query: stringifiedSearchQuery,
      })
    );
  };
  const toggleSelectionForThisMember = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (event.detail === 2) {
      // double-click
      dispatch(bulkAlignMemberSelection({ slot, face }));
    } else if (event.shiftKey) {
      // shift-click
      dispatch(expandSelection({ slot, face }));
    } else {
      dispatch(toggleMemberSelection({ slot, face }));
    }
  };

  const setSelectedImageFromIdentifier = (selectedImage: string) => {
    dispatch(
      setSelectedImages({
        slots: slotsToModify,
        selectedImage,
        deselect: true,
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
      <CardGridContextMenu
        id={id}
        searchQuery={searchQuery}
        face={face}
        slot={slot}
      />
    </>
  );
  const cardFooter = (
    <CardFooter
      searchResults={searchResultsForQuery}
      selectedImageIndex={selectedImageIndex}
      selected={projectMember?.selected ?? false}
      setSelectedImageFromIdentifier={setSelectedImageFromIdentifier}
      handleShowGridSelector={handleShowGridSelector}
    />
  );

  //# endregion

  return (
    <div
      ref={ref}
      data-testid={`${face}-slot${slot}`}
      style={{ opacity: isDragging ? 0.7 : undefined }}
    >
      <MemoizedEditorCard
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
        cardHeaderTitle={cardHeaderTitle}
        cardFooter={cardFooter}
        cardHeaderButtons={cardHeaderButtons}
        handleRef={handleRef}
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
          searchq={searchQuery?.query ?? undefined}
        />
      )}
    </div>
  );
}

export const MemoizedCardSlot = memo(CardSlot);

//# endregion
