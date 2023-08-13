/**
 * This component exposes a bootstrap Alert to display the number of selected images
 * and facilitate operating on the selected images in bulk - updating their queries,
 * setting their selected versions, or deleting them from the project.
 */

import React, { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Stack from "react-bootstrap/Stack";

import { Slots, useAppDispatch, useAppSelector } from "@/common/types";
import { GridSelectorModal } from "@/features/modals/gridSelectorModal";
import { setSelectedSlotsAndShowModal } from "@/features/modals/modalsSlice";
import {
  bulkClearQuery,
  bulkDeleteSlots,
  bulkSetMemberSelection,
  bulkSetSelectedImage,
  selectAllSelectedProjectMembersHaveTheSameQuery,
  selectSelectedSlots,
} from "@/features/project/projectSlice";
import { selectSearchResultsForQueryOrDefault } from "@/features/search/searchResultsSlice";

function ChangeSelectedImageSelectedImages({ slots }: { slots: Slots }) {
  /**
   * sorry for the stupid naming convention here 🗿
   */

  // TODO: this component is fairly messy and should be tidied up

  const dispatch = useAppDispatch();

  const [
    showChangeSelectedImageSelectedImagesModal,
    setShowChangeSelectedImageSelectedImagesModal,
  ] = useState<boolean>(false);
  const handleCloseChangeSelectedImageSelectedImagesModal = () =>
    setShowChangeSelectedImageSelectedImagesModal(false);
  const handleShowChangeSelectedImageSelectedImagesModal = () =>
    setShowChangeSelectedImageSelectedImagesModal(true);

  const onSubmit = (selectedImage: string): void => {
    dispatch(bulkSetSelectedImage({ selectedImage, slots }));
    handleCloseChangeSelectedImageSelectedImagesModal();
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
            onClick={handleShowChangeSelectedImageSelectedImagesModal}
          >
            <i className="bi bi-image" style={{ paddingRight: 0.5 + "em" }} />{" "}
            Change Version
          </Dropdown.Item>
        )}
      {searchResultsForQueryOrDefault != null && (
        <GridSelectorModal
          testId="bulk-grid-selector"
          imageIdentifiers={searchResultsForQueryOrDefault}
          show={showChangeSelectedImageSelectedImagesModal}
          handleClose={handleCloseChangeSelectedImageSelectedImagesModal}
          onClick={onSubmit}
        />
      )}
    </>
  );
}

function ChangeSelectedImageQueries({ slots }: { slots: Slots }) {
  const dispatch = useAppDispatch();

  const handleShowChangeSelectedImageQueriesModal = () => {
    dispatch(setSelectedSlotsAndShowModal([slots, "changeQuery"]));
  };

  return (
    <>
      <Dropdown.Item
        className="text-decoration-none"
        onClick={handleShowChangeSelectedImageQueriesModal}
      >
        <i
          className="bi bi-arrow-repeat"
          style={{ paddingRight: 0.5 + "em" }}
        />{" "}
        Change Query
      </Dropdown.Item>
    </>
  );
}

function ClearSelectedImageQueries({ slots }: { slots: Slots }) {
  const dispatch = useAppDispatch();
  const onClick = () => dispatch(bulkClearQuery({ slots }));
  return (
    <Dropdown.Item onClick={onClick} className="text-decoration-none">
      <i className="bi bi-slash-circle" style={{ paddingRight: 0.5 + "em" }} />{" "}
      Clear Query
    </Dropdown.Item>
  );
}

function DeleteSelectedImages({ slots }: { slots: Slots }) {
  const dispatch = useAppDispatch();

  const slotNumbers = slots.map(([face, slot]) => slot);
  const onClick = () => dispatch(bulkDeleteSlots({ slots: slotNumbers }));

  return (
    <Dropdown.Item onClick={onClick} className="text-decoration-none">
      <i className="bi bi-x-circle" style={{ paddingRight: 0.5 + "em" }} />{" "}
      Delete Slots
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
