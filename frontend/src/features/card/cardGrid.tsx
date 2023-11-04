/**
 * This component displays all `CardSlot`s in the project.
 */

import React from "react";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import styled from "styled-components";

import { Back, Front } from "@/common/constants";
import { useAppSelector } from "@/common/types";
import { Spinner } from "@/components/spinner";
import { MemoizedCardSlot } from "@/features/card/cardSlot";
import {
  selectIsProjectEmpty,
  selectProjectMembers,
} from "@/features/project/projectSlice";
import { selectFrontsVisible } from "@/features/viewSettings/viewSettingsSlice";

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

  const fetchingCardData = useAppSelector(
    (state) =>
      state.cardDocuments.status == "loading" ||
      state.searchResults.status === "loading"
  );
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);
  const frontsVisible = useAppSelector(selectFrontsVisible);
  const projectMembers = useAppSelector(selectProjectMembers);

  //# endregion

  const cardSlotsFronts = [];
  const cardSlotsBacks = [];

  for (const [slot, slotProjectMember] of projectMembers.entries()) {
    cardSlotsFronts.push(
      <MemoizedCardSlot
        key={`${Front}-slot${slot}`}
        searchQuery={slotProjectMember.front?.query}
        face={Front}
        slot={slot}
      ></MemoizedCardSlot>
    );
    cardSlotsBacks.push(
      <MemoizedCardSlot
        key={`${Back}-slot${slot}`}
        searchQuery={slotProjectMember.back?.query}
        face={Back}
        slot={slot}
      ></MemoizedCardSlot>
    );
  }

  // TODO: should we aim to lift state up here and conditionally render rather than hide?
  return (
    <>
      {projectMembers.length == 0 && <CardGridDefault />}
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
