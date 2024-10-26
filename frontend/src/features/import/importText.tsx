/**
 * This component is the text-based entrypoint for cards into the project editor
 * (probably the primary way that users upload cards).
 * A freeform text area is exposed and the cards are processed when the user hits Submit.
 */

import React, { FormEvent, useRef, useState } from "react";
import { Accordion } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import { useGetDFCPairsQuery, useGetSampleCardsQuery } from "@/app/api";
import {
  Card,
  Cardback,
  FaceSeparator,
  ProjectName,
  ReversedCardTypePrefixes,
  SelectedImageSeparator,
  Token,
} from "@/common/constants";
import {
  convertLinesIntoSlotProjectMembers,
  formatPlaceholderText,
  processStringAsMultipleLines,
} from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { toTitleCase } from "@/common/utils";
import { RightPaddedIcon } from "@/components/icon";
import { addMembers, selectProjectSize } from "@/features/project/projectSlice";
import { selectFuzzySearch } from "@/features/searchSettings/searchSettingsSlice";

export function ImportText() {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const sampleCardsQuery = useGetSampleCardsQuery();
  const dfcPairsQuery = useGetDFCPairsQuery();
  const fuzzySearch = useAppSelector(selectFuzzySearch);
  const projectSize = useAppSelector(selectProjectSize);

  //# endregion

  //# region state

  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const [textModalValue, setTextModalValue] = useState<string>("");
  const focusRef = useRef<HTMLTextAreaElement>(null);

  //# endregion

  //# region callbacks

  const handleCloseTextModal = () => setShowTextModal(false);
  const handleShowTextModal = () => setShowTextModal(true);

  /**
   * Parse the contents of the modal and add the resultant queries in the desired numbers of instances to the project.
   */
  const handleSubmitTextModal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // to prevent reloading the page
    const processedLines = processStringAsMultipleLines(
      textModalValue,
      dfcPairsQuery.data ?? {},
      fuzzySearch
    );
    dispatch(
      addMembers({
        members: convertLinesIntoSlotProjectMembers(
          processedLines,
          projectSize
        ),
      })
    );
    setTextModalValue(""); // safe to delete the user's data now that it has been processed
    handleCloseTextModal();
  };

  //# endregion

  //# region computed constants

  const disabled = dfcPairsQuery.isFetching;
  const placeholderText =
    sampleCardsQuery.data != null
      ? formatPlaceholderText(sampleCardsQuery.data)
      : "";

  //# endregion

  return (
    <>
      <Dropdown.Item onClick={handleShowTextModal}>
        <RightPaddedIcon bootstrapIconName="card-text" /> Text
      </Dropdown.Item>
      <Modal
        scrollable
        show={showTextModal}
        onEntered={() => {
          if (focusRef.current) {
            focusRef.current.focus();
          }
        }}
        onHide={handleCloseTextModal}
        data-testid="import-text"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — Text</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Type the names of the cards you&apos;d like to add to your order and
            hit <b>Submit</b>. One card per line.
          </p>
          <Accordion>
            <Accordion.Item eventKey="0">
              <Accordion.Header>Syntax Guide</Accordion.Header>
              <Accordion.Body>
                <ul>
                  <li>
                    There are three types of images in {ProjectName} &mdash;{" "}
                    {Card.toLowerCase()}s, {Cardback.toLowerCase()}s, and{" "}
                    {Token.toLowerCase()}s. If you search for a card, the search
                    results <b>won&apos;t contain cardbacks or tokens</b>.
                  </li>
                  <li>
                    <b>{toTitleCase(Card)}s</b> are searched for by default.
                  </li>
                  <li>
                    Search for <b>{Token.toLowerCase()}s</b> by putting{" "}
                    <code>{ReversedCardTypePrefixes[Token]}</code> at the start
                    of the query &mdash; for example,{" "}
                    <code>
                      {ReversedCardTypePrefixes[Token]}your{" "}
                      {Token.toLowerCase()} name
                    </code>
                    .
                  </li>
                  <li>
                    Search for <b>{Cardback.toLowerCase()}s</b> by putting{" "}
                    <code>{ReversedCardTypePrefixes[Cardback]}</code> at the
                    start of the query &mdash; for example,{" "}
                    <code>
                      {ReversedCardTypePrefixes[Cardback]}your{" "}
                      {Cardback.toLowerCase()} name
                    </code>
                    .
                  </li>
                  <li>
                    You may optionally specify the image ID to select by typing
                    your search query, <code>{SelectedImageSeparator}</code>,
                    then the image ID — for example,{" "}
                    <code>
                      your {Card.toLowerCase()} name{SelectedImageSeparator}
                      1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5
                    </code>
                    .
                  </li>
                  <li>
                    You may specify queries for both the front and the back by
                    separating them with <code>{FaceSeparator}</code> — for
                    example,{" "}
                    <code>
                      4x goblin {FaceSeparator}{" "}
                      {ReversedCardTypePrefixes[Token]}elf
                    </code>
                    .
                  </li>
                  <li>
                    If you don&apos;t specify a back query and your front query
                    is a double-faced card, we will automatically query the back
                    card for you.
                  </li>
                </ul>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
          <br />
          <Form id="importTextForm" onSubmit={handleSubmitTextModal}>
            <Form.Group className="mb-3">
              <Form.Control
                ref={focusRef}
                as="textarea"
                rows={12}
                placeholder={placeholderText}
                required={true}
                onChange={(event) => setTextModalValue(event.target.value)}
                value={textModalValue}
                aria-label="import-text"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            aria-label="import-text-close"
            onClick={handleCloseTextModal}
          >
            Close
          </Button>
          <Button
            variant="primary"
            form="importTextForm"
            type="submit"
            aria-label="import-text-submit"
            disabled={disabled}
          >
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
