/**
 * This component exposes a bootstrap Alert to display the number of selected images
 * and facilitates operating on the selected images in bulk - updating their queries,
 * setting their selected versions, or deleting them from the project.
 */

import React, { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Stack from "react-bootstrap/Stack";

import { Faces, Slots, useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { GridSelectorModal } from "@/features/gridSelector/gridSelectorModal";
import { setSelectedSlotsAndShowModal } from "@/features/modals/modalsSlice";
import {
  bulkAlignMemberSelection,
  bulkSetMemberSelection,
  clearQueries,
  deleteSlots,
  selectAllSelectedProjectMembersHaveTheSameQuery,
  selectAllSlotsForFace,
  selectSelectedSlots,
  setSelectedImages,
} from "@/features/project/projectSlice";
import { selectSearchResultsForQueryOrDefault } from "@/features/search/searchResultsSlice";
import { selectActiveFace } from "@/features/viewSettings/viewSettingsSlice";

function SelectSimilar({ slot }: { slot: [Faces, number] }) {
  /**
   * Clicking this is equivalent to double-clicking a CardSlot's checkbox.
   * If other slots have the same query as `slot`, clicking this will select them all.
   */

  const dispatch = useAppDispatch();
  const onClick = () =>
    dispatch(bulkAlignMemberSelection({ slot: slot[1], face: slot[0] }));
  return (
    <Dropdown.Item onClick={onClick} className="text-decoration-none">
      <RightPaddedIcon bootstrapIconName="arrows-angle-expand" /> Select Similar
    </Dropdown.Item>
  );
}

function SelectAll() {
  /**
   * Clicking this selects all slots in the active face.
   */

  const dispatch = useAppDispatch();

  const face = useAppSelector(selectActiveFace);
  const slots = useAppSelector((state) => selectAllSlotsForFace(state, face));
  const onClick = () =>
    dispatch(bulkSetMemberSelection({ selectedStatus: true, slots: slots }));

  return (
    <Dropdown.Item onClick={onClick} className="text-decoration-none">
      <RightPaddedIcon bootstrapIconName="arrows-fullscreen" /> Select All
    </Dropdown.Item>
  );
}

function ChangeSelectedImageSelectedImages({ slots }: { slots: Slots }) {
  /**
   * Clicking this brings up the grid selector modal for changing the selected images for multiple slots at once.
   * sorry for the stupid naming convention here 🗿
   */

  const dispatch = useAppDispatch();

  const [showModal, setShowModal] = useState<boolean>(false);
  const handleShowModal = () => setShowModal(true);
  const handleHideModal = () => setShowModal(false);

  const handleChangeImages = (selectedImage: string): void => {
    dispatch(setSelectedImages({ selectedImage, slots, deselect: true }));
    handleHideModal();
  };

  const query = useAppSelector((state) =>
    selectAllSelectedProjectMembersHaveTheSameQuery(state, slots)
  );

  const cardbacks = useAppSelector((state) => state.cardbacks.cardbacks) ?? [];
  // calling slots[0] is safe because this component will only be rendered with > 0 slots selected
  const searchResultsForQueryOrDefault = useAppSelector((state) =>
    selectSearchResultsForQueryOrDefault(state, query, slots[0][0], cardbacks)
  );

  return (
    <>
      {searchResultsForQueryOrDefault != null &&
        searchResultsForQueryOrDefault.length > 1 && (
          <Dropdown.Item
            className="text-decoration-none"
            onClick={handleShowModal}
          >
            <RightPaddedIcon bootstrapIconName="image" /> Change Version
          </Dropdown.Item>
        )}
      {searchResultsForQueryOrDefault != null && (
        <GridSelectorModal
          testId="bulk-grid-selector"
          imageIdentifiers={searchResultsForQueryOrDefault}
          show={showModal}
          handleClose={handleHideModal}
          onClick={handleChangeImages}
        />
      )}
    </>
  );
}

function ChangeSelectedImageQueries({ slots }: { slots: Slots }) {
  /**
   * Clicking this brings up the modal for changing the queries for multiple slots at once.
   */

  const dispatch = useAppDispatch();

  const handleShowModal = () => {
    dispatch(setSelectedSlotsAndShowModal([slots, "changeQuery"]));
  };

  return (
    <>
      <Dropdown.Item className="text-decoration-none" onClick={handleShowModal}>
        <RightPaddedIcon bootstrapIconName="arrow-repeat" /> Change Query
      </Dropdown.Item>
    </>
  );
}

function ClearSelectedImageQueries({ slots }: { slots: Slots }) {
  /**
   * Clicking this clears the queries for multiple slots at once.
   */

  const dispatch = useAppDispatch();
  const onClick = () => dispatch(clearQueries({ slots }));
  return (
    <Dropdown.Item onClick={onClick} className="text-decoration-none">
      <RightPaddedIcon bootstrapIconName="slash-circle" /> Clear Query
    </Dropdown.Item>
  );
}

function DeleteSelectedImages({ slots }: { slots: Slots }) {
  /**
   * Clicking this deletes multiple slots at once.
   */

  const dispatch = useAppDispatch();

  const slotNumbers = slots.map(([face, slot]) => slot);
  const onClick = () => dispatch(deleteSlots({ slots: slotNumbers }));

  return (
    <Dropdown.Item onClick={onClick} className="text-decoration-none">
      <RightPaddedIcon bootstrapIconName="x-circle" /> Delete Slots
    </Dropdown.Item>
  );
}

export function SelectedImagesStatus() {
  const slots = useAppSelector(selectSelectedSlots);

  const dispatch = useAppDispatch();
  const onClick = () =>
    dispatch(bulkSetMemberSelection({ selectedStatus: false, slots }));

  return (
    <>
      <Alert
        variant="primary"
        style={{ display: slots.length > 0 ? "" : "none" }}
      >
        <Stack direction="horizontal" gap={2}>
          {slots.length} image
          {slots.length != 1 && "s"} selected.
          <Button
            onClick={onClick}
            className="ms-auto"
            data-testid="clear-selection"
          >
            <i className="bi bi-x-lg" />
          </Button>
          {slots.length > 0 && (
            <Dropdown>
              <Dropdown.Toggle variant="secondary">Modify</Dropdown.Toggle>
              <Dropdown.Menu>
                {slots.length === 1 && <SelectSimilar slot={slots[0]} />}
                <SelectAll />
                <Dropdown.Divider />
                <ChangeSelectedImageSelectedImages slots={slots} />
                <ChangeSelectedImageQueries slots={slots} />
                <Dropdown.Divider />
                <ClearSelectedImageQueries slots={slots} />
                <DeleteSelectedImages slots={slots} />
              </Dropdown.Menu>
            </Dropdown>
          )}
        </Stack>
      </Alert>
    </>
  );
}
