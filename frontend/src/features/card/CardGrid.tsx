/**
 * This component displays all `CardSlot`s in the project.
 */

import { DragDropProvider, PointerSensor } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import styled from "@emotion/styled";
import React, { useCallback } from "react";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";

import { Back, Front } from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { Spinner } from "@/components/Spinner";
import { MemoizedCardSlot } from "@/features/card/CardSlot";
import {
  moveSlot,
  selectIsProjectEmpty,
  selectProjectMembers,
} from "@/store/slices/projectSlice";
import { selectFrontsVisible } from "@/store/slices/viewSettingsSlice";

const CardGridDefaultBackground = styled.div`
  position: absolute;
  border: 1px darkgray solid;
  border-radius: 10px;
  height: 100%;
  width: 100%;
  box-shadow: 0 0 50px 0 black inset;
`;

const CardGridDefaultText = styled.div`
  position: relative;
  font-size: 1.25em;
  text-align: center;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-shadow: 0 4px 15px #000000;
  max-width: 90%;
`;

function CardGridDefault() {
  return (
    <CardGridDefaultBackground>
      <CardGridDefaultText>
        <p>Your project is empty at the moment.</p>
        <p>
          Use the <b>Add Cards</b> menu on the right to get started!
        </p>
      </CardGridDefaultText>
    </CardGridDefaultBackground>
  );
}

export function CardGrid() {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const fetchingCardData = useAppSelector(
    (state) => state.searchResults.status === "loading"
  );
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);
  const frontsVisible = useAppSelector(selectFrontsVisible);
  const projectMembers = useAppSelector(selectProjectMembers);

  //# endregion

  const handleDragEnd = useCallback(
    (event: any) => {
      const { source } = event.operation;
      if (
        source &&
        isSortable(source) &&
        source.initialIndex !== source.index
      ) {
        dispatch(
          moveSlot({ fromIndex: source.initialIndex, toIndex: source.index })
        );
      }
    },
    [dispatch]
  );

  const cardSlotsFronts = [];
  const cardSlotsBacks = [];

  for (const [slot, slotProjectMember] of projectMembers.entries()) {
    cardSlotsFronts.push(
      <MemoizedCardSlot
        key={`${Front}-${slotProjectMember.id}`}
        id={slotProjectMember.id}
        searchQuery={slotProjectMember.front?.query}
        face={Front}
        slot={slot}
      ></MemoizedCardSlot>
    );
    cardSlotsBacks.push(
      <MemoizedCardSlot
        key={`${Back}-${slotProjectMember.id}`}
        id={slotProjectMember.id}
        searchQuery={slotProjectMember.back?.query}
        face={Back}
        slot={slot}
      ></MemoizedCardSlot>
    );
  }

  const sensors = [
    PointerSensor.configure({
      preventActivation: (event: PointerEvent) =>
        (event.target as Element).closest("button") != null ||
        (event.target as Element).closest("a.dropdown-item") != null,
    }),
  ];

  // TODO: should we aim to lift state up here and conditionally render rather than hide?
  return (
    <>
      {projectMembers.length == 0 && <CardGridDefault />}
      <DragDropProvider sensors={sensors} onDragEnd={handleDragEnd}>
        <Row
          xxl={4}
          lg={3}
          md={2}
          sm={1}
          xs={1}
          className="g-0"
          style={{ display: frontsVisible ? "" : "none" }}
        >
          {cardSlotsFronts}
        </Row>
      </DragDropProvider>
      <DragDropProvider sensors={sensors} onDragEnd={handleDragEnd}>
        <Row
          xxl={4}
          lg={3}
          md={2}
          sm={1}
          xs={1}
          className="g-0"
          style={{ display: frontsVisible ? "none" : "" }}
        >
          {cardSlotsBacks}
        </Row>
      </DragDropProvider>
      <Modal scrollable show={fetchingCardData && !isProjectEmpty} centered>
        <Modal.Header>
          <Modal.Title
            style={{ textAlign: "center", userSelect: "none" }}
            className="w-100"
          >
            Loading your cards...
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Spinner />
        </Modal.Body>
      </Modal>
    </>
  );
}
