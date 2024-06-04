/**
 * A higher-level wrapper for the `Card` component with additional functionality.
 * Card slots allow modifying the selected image for the given slot number and face,
 * both via previous/next arrows and the grid selector. Clicking the selected image
 * displays the detailed view. Card slots can be deleted, which also deletes the
 * card slot for the same slot number in the other face.
 */

import React, { memo, useState } from "react";

import { RootState } from "@/app/store";
import {
  Faces,
  SearchQuery,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { wrapIndex } from "@/common/utils";
import { MemoizedEditorCard } from "@/features/card/Card";
import { CardFooter } from "@/features/card/CardFooter";
import { GridSelectorModal } from "@/features/gridSelector/GridSelectorModal";
import { useLocalFilesContext } from "@/features/localFiles/localFilesContext";
import { selectCardDocumentByIdentifier } from "@/features/search/cardDocumentsSlice";
import { showChangeQueryModal } from "@/store/slices/modalsSlice";
import {
  bulkAlignMemberSelection,
  deleteSlots,
  expandSelection,
  selectAllSelectedProjectMembersHaveTheSameQuery,
  selectProjectMember,
  selectSelectedSlots,
  setSelectedImages,
  toggleMemberSelection,
} from "@/store/slices/projectSlice";
import { selectSearchResultsForQueryOrDefault } from "@/store/slices/searchResultsSlice";

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
  const searchResultsForQueryOrDefault = useAppSelector((state) =>
    selectSearchResultsForQueryOrDefault(
      state,
      searchQuery?.query,
      searchQuery?.cardType,
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
    selectedQuery != null &&
    // can't use object equality check here
    selectedQuery.query === searchQuery?.query &&
    selectedQuery.cardType === searchQuery?.cardType;
  const slotsToModify: Array<[Faces, number]> = modifySelectedSlots
    ? selectedSlots
    : [[face, slot]];

  const [directoryIndexes, setDirectoryIndexes] = useLocalFilesContext();
  const localResults = directoryIndexes.flatMap((directoryIndex) =>
    directoryIndex.index && searchQuery?.query
      ? directoryIndex.index.fuse.search(searchQuery.query)
      : []
  );
  // alert(JSON.stringify(localResults))

  //# endregion

  //# region state

  const [showGridSelector, setShowGridSelector] = useState<boolean>(false);

  //# endregion

  //# region callbacks

  const handleCloseGridSelector = () => setShowGridSelector(false);
  const handleShowGridSelector = () => setShowGridSelector(true);
  const handleShowChangeSelectedImageQueriesModal = () => {
    dispatch(
      showChangeQueryModal({
        slots: [[face, slot]],
        query: searchQuery?.query ?? null,
      })
    );
  };
  // TODO: add a confirmation prompt here. yes/no/yes and don't ask again.
  const deleteThisSlot = () => {
    dispatch(deleteSlots({ slots: [slot] }));
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
    <CardFooter
      searchResults={searchResultsForQuery}
      selectedImageIndex={selectedImageIndex}
      selected={projectMember?.selected ?? false}
      setSelectedImageFromIdentifier={setSelectedImageFromIdentifier}
      handleShowGridSelector={handleShowGridSelector}
    />
  );

  //# endregion

  // TODO: this is just a temporary hack for releasing some dopamine before i sign off for the night. remove later
  const maybeCardDocument = useAppSelector((state: RootState) =>
    localResults.length > 0
      ? localResults[0].item
      : selectCardDocumentByIdentifier(state, selectedImage)
  );
  const maybePreviousCardDocument = useAppSelector((state: RootState) =>
    selectCardDocumentByIdentifier(state, previousImage)
  );
  const maybeNextCardDocument = useAppSelector((state: RootState) =>
    selectCardDocumentByIdentifier(state, nextImage)
  );

  return (
    <div data-testid={`${face}-slot${slot}`}>
      <Card
        maybeCardDocument={maybeCardDocument}
        maybePreviousCardDocument={maybePreviousCardDocument}
        maybeNextCardDocument={maybeNextCardDocument}
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
