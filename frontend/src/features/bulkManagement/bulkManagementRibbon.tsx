/**
 * This component exposes a ribbon which displays the number of selected images
 * and facilitates operating on the selected images in bulk - updating their queries,
 * setting their selected versions, or deleting them from the project.
 */

import React, {
  ButtonHTMLAttributes,
  PropsWithChildren,
  ReactElement,
  useState,
} from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Stack from "react-bootstrap/Stack";
import styled from "styled-components";

import { Faces, Slots, useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { OverflowList } from "@/components/OverflowList";
import { useQueueImageDownload } from "@/features/download/downloadImages";
import { GridSelectorModal } from "@/features/gridSelector/gridSelectorModal";
import { setSelectedSlotsAndShowModal } from "@/features/modals/modalsSlice";
import {
  bulkAlignMemberSelection,
  bulkSetMemberSelection,
  clearQueries,
  deleteSlots,
  selectAllSelectedProjectMembersHaveTheSameQuery,
  selectAllSlotsForFace,
  selectIsProjectEmpty,
  selectProjectMember,
  selectSelectedSlots,
  selectUniqueCardIdentifiersInSlots,
  setSelectedImages,
} from "@/features/project/projectSlice";
import { useCardDocumentsByIdentifier } from "@/features/search/cardDocumentsSlice";
import { selectSearchResultsForQueryOrDefault } from "@/features/search/searchResultsSlice";
import { setNotification } from "@/features/toasts/toastsSlice";
import { selectActiveFace } from "@/features/viewSettings/viewSettingsSlice";

const RibbonText = styled.p`
  font-size: 0.9em;
  user-select: none;
  -webkit-user-select: none;
  white-space: nowrap;
`;

const HoverableRibbonText = styled(RibbonText)<{
  danger?: boolean;
}>`
  &:hover {
    background-color: ${(props) =>
      props?.danger ? "rgba(255, 50, 50, 30%)" : "rgba(100, 100, 100, 30%)"};
  }
  border-radius: 4px;
  transition: background-color 0.1s ease-in-out;
  cursor: pointer;
`;

interface RibbonButtonProps
  extends PropsWithChildren<ButtonHTMLAttributes<HTMLDivElement>> {
  inDropdown: boolean;
  danger?: boolean;
}

function RibbonButton({
  children,
  onClick,
  inDropdown,
  danger = false,
}: RibbonButtonProps) {
  return inDropdown ? (
    <Dropdown.Item onClick={onClick}>{children}</Dropdown.Item>
  ) : (
    <HoverableRibbonText
      onClick={onClick}
      className="px-2 py-1 text-decoration-none"
      danger={danger}
    >
      {children}
    </HoverableRibbonText>
  );
}

function SelectSimilar({
  slot,
  inDropdown,
}: {
  slot: [Faces, number];
  inDropdown: boolean;
}) {
  /**
   * Clicking this is equivalent to double-clicking a CardSlot's checkbox.
   * If other slots have the same query as `slot`, clicking this will select them all.
   */

  const dispatch = useAppDispatch();
  const onClick = () =>
    dispatch(bulkAlignMemberSelection({ slot: slot[1], face: slot[0] }));
  return (
    <RibbonButton onClick={onClick} inDropdown={inDropdown}>
      <RightPaddedIcon bootstrapIconName="arrows-angle-expand" /> Select Similar
    </RibbonButton>
  );
}

function SelectAll({ inDropdown }: { inDropdown: boolean }) {
  /**
   * Clicking this selects all slots in the active face.
   */

  const dispatch = useAppDispatch();

  const face = useAppSelector(selectActiveFace);
  const slots = useAppSelector((state) => selectAllSlotsForFace(state, face));
  const onClick = () =>
    dispatch(bulkSetMemberSelection({ selectedStatus: true, slots: slots }));

  return (
    <RibbonButton onClick={onClick} inDropdown={inDropdown}>
      <RightPaddedIcon bootstrapIconName="arrows-fullscreen" /> Select All
    </RibbonButton>
  );
}

function ChangeSelectedImageSelectedImages({
  slots,
  inDropdown,
}: {
  slots: Slots;
  inDropdown: boolean;
}) {
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
  const searchResultsForQueryOrDefault = useAppSelector((state) =>
    slots.length > 0
      ? selectSearchResultsForQueryOrDefault(
          state,
          query,
          slots[0][0],
          cardbacks
        )
      : undefined
  );

  return slots.length > 0 ? (
    <>
      {searchResultsForQueryOrDefault != null &&
        searchResultsForQueryOrDefault.length > 1 && (
          <RibbonButton onClick={handleShowModal} inDropdown={inDropdown}>
            <RightPaddedIcon bootstrapIconName="image" /> Change Version
          </RibbonButton>
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
  ) : null;
}

function ChangeSelectedImageQueries({
  slots,
  inDropdown,
}: {
  slots: Slots;
  inDropdown: boolean;
}) {
  /**
   * Clicking this brings up the modal for changing the queries for multiple slots at once.
   */

  const dispatch = useAppDispatch();

  const handleShowModal = () => {
    dispatch(setSelectedSlotsAndShowModal([slots, "changeQuery"]));
  };

  return (
    <RibbonButton onClick={handleShowModal} inDropdown={inDropdown}>
      <RightPaddedIcon bootstrapIconName="arrow-repeat" /> Change Query
    </RibbonButton>
  );
}

function ClearSelectedImageQueries({
  slots,
  inDropdown,
}: {
  slots: Slots;
  inDropdown: boolean;
}) {
  /**
   * Clicking this clears the queries for multiple slots at once.
   */

  const dispatch = useAppDispatch();
  const onClick = () => dispatch(clearQueries({ slots }));
  return (
    <RibbonButton onClick={onClick} inDropdown={inDropdown}>
      <RightPaddedIcon bootstrapIconName="slash-circle" /> Clear Query
    </RibbonButton>
  );
}

function DownloadSelectedImages({
  slots,
  inDropdown,
}: {
  slots: Slots;
  inDropdown: boolean;
}) {
  /**
   * Clicking this enqueues downloads for the selected iamegs.
   */

  const dispatch = useAppDispatch();
  const cardDocumentsByIdentifier = useCardDocumentsByIdentifier();
  const queueImageDownload = useQueueImageDownload();
  const identifiers = useAppSelector((state) =>
    selectUniqueCardIdentifiersInSlots(state, slots)
  );

  const onClick = () => {
    let n = 0;
    identifiers.forEach((identifier) => {
      if (cardDocumentsByIdentifier[identifier]) {
        queueImageDownload(cardDocumentsByIdentifier[identifier]);
        n++;
      }
    });
    dispatch(bulkSetMemberSelection({ selectedStatus: false, slots }));
    dispatch(
      setNotification([
        Math.random().toString(),
        {
          name: "Enqueued Downloads",
          message: `Enqueued ${n} image download${n != 1 ? "s" : ""}!`,
          level: "info",
        },
      ])
    );
  };

  return (
    <RibbonButton onClick={onClick} inDropdown={inDropdown}>
      <RightPaddedIcon bootstrapIconName="cloud-arrow-down" /> Download Images
    </RibbonButton>
  );
}

function DeleteSelectedImages({
  slots,
  inDropdown,
}: {
  slots: Slots;
  inDropdown: boolean;
}) {
  /**
   * Clicking this deletes multiple slots at once.
   */

  const dispatch = useAppDispatch();

  const slotNumbers = slots.map(([face, slot]) => slot);
  const onClick = () => dispatch(deleteSlots({ slots: slotNumbers }));

  return (
    <RibbonButton onClick={onClick} inDropdown={inDropdown} danger>
      <RightPaddedIcon bootstrapIconName="x-circle" /> Delete Cards
    </RibbonButton>
  );
}

const VerticallyCentredStack = styled(Stack)`
  position: relative;
  top: calc(
    50% - 20px
  ); // can't use transform: translate(0, -50%) because it messes with the dropdown
`;

type OptionKey =
  | "selectSimilar"
  | "selectAll"
  | "changeSelectedImageSelectedImages"
  | "changeSelectedImageQueries"
  | "clearSelectedImageQueries"
  | "downloadSelectedImages"
  | "deleteSelectedImages";

export function SelectedImagesRibbon() {
  const slots = useAppSelector(selectSelectedSlots);
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  const dispatch = useAppDispatch();
  const onClick = () =>
    dispatch(bulkSetMemberSelection({ selectedStatus: false, slots }));

  const renderOption = (key: OptionKey, inDropdown: boolean): ReactElement => {
    switch (key) {
      case "selectSimilar":
        return <SelectSimilar slot={slots[0]} inDropdown={inDropdown} />;
      case "selectAll":
        return <SelectAll inDropdown={inDropdown} />;
      case "changeSelectedImageSelectedImages":
        return (
          <ChangeSelectedImageSelectedImages
            slots={slots}
            inDropdown={inDropdown}
          />
        );
      case "changeSelectedImageQueries":
        return (
          <ChangeSelectedImageQueries slots={slots} inDropdown={inDropdown} />
        );
      case "clearSelectedImageQueries":
        return (
          <ClearSelectedImageQueries slots={slots} inDropdown={inDropdown} />
        );
      case "downloadSelectedImages":
        return <DownloadSelectedImages slots={slots} inDropdown={inDropdown} />;
      case "deleteSelectedImages":
        return <DeleteSelectedImages slots={slots} inDropdown={inDropdown} />;
    }
  };
  const enabledOptions: Array<OptionKey> = [
    ...((slots.length > 0
      ? [
          "changeSelectedImageSelectedImages",
          "changeSelectedImageQueries",
          // "clearSelectedImageQueries",
          "downloadSelectedImages",
          "deleteSelectedImages",
        ]
      : []) as Array<OptionKey>),
    ...((slots.length === 1 ? ["selectSimilar"] : []) as Array<OptionKey>),
    ...((!isProjectEmpty ? ["selectAll"] : []) as Array<OptionKey>),
  ];

  const itemRenderer = (item: OptionKey, index: number) =>
    renderOption(item, false);
  const overflowRenderer = (items: Array<OptionKey>) => {
    return (
      <Dropdown>
        <Dropdown.Toggle
          style={{ height: 29.6 + "px" }}
          variant="secondary"
          data-testid="more-select-options"
        >
          <i className="bi bi-three-dots" />
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {items.map((item) => renderOption(item, true))}
        </Dropdown.Menu>
      </Dropdown>
    );
  };

  return (
    <VerticallyCentredStack direction="horizontal" className="px-2" gap={0}>
      <RibbonText className="px-2">
        <b>{slots.length}</b> card
        {slots.length != 1 && "s"} selected.
      </RibbonText>
      {slots.length > 0 && (
        <>
          <RibbonButton onClick={onClick} inDropdown={false}>
            <i className="bi bi-x-lg" />
          </RibbonButton>
          <RibbonText>│</RibbonText>
        </>
      )}
      <div className="ms-auto" />
      <OverflowList
        items={enabledOptions}
        itemRenderer={itemRenderer}
        overflowRenderer={overflowRenderer}
        minVisibleItems={0}
        collapseFrom="end"
      />
    </VerticallyCentredStack>
  );
}
