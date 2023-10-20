/**
 * This component is the text-based entrypoint for cards into the project editor
 * (probably the primary way that users upload cards).
 * A freeform text area is exposed and the cards are processed when the user hits Submit.
 */

import React, { useEffect, useState } from "react";
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
  processStringAsMultipleLines,
  stripTextInParentheses,
} from "@/common/processing";
import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { toTitleCase } from "@/common/utils";
import { RightPaddedIcon } from "@/components/icon";
import { addMembers, selectProjectSize } from "@/features/project/projectSlice";
import { selectFuzzySearch } from "@/features/searchSettings/searchSettingsSlice";

export function ImportText() {
  const sampleCardsQuery = useGetSampleCardsQuery();
  const dfcPairsQuery = useGetDFCPairsQuery();

  const fuzzySearch = useAppSelector(selectFuzzySearch);

  const dispatch = useAppDispatch();
  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const handleCloseTextModal = () => setShowTextModal(false);
  const handleShowTextModal = () => setShowTextModal(true);
  const [textModalValue, setTextModalValue] = useState<string>("");
  const [placeholderText, setPlaceholderText] = useState<string>("");

  const projectSize = useAppSelector(selectProjectSize);

  const formatPlaceholderText = (placeholders: {
    [cardType: string]: Array<CardDocument>;
  }): string => {
    // TODO: check compatibility of `\n` in different browsers. `separator` was previously "&#10;".

    const separator = "\n";
    const placeholderTextByCardType: Array<string> = [];

    for (const cardType of [Card, Token, Cardback]) {
      if (placeholders[cardType] != null) {
        placeholderTextByCardType.push(
          placeholders[cardType]
            .map(
              (x) =>
                `${Math.floor(Math.random() * 3) + 1}x ${
                  ReversedCardTypePrefixes[cardType]
                }${stripTextInParentheses(x.name)}`
            )
            .join(separator)
        );
      }
    }
    return placeholderTextByCardType.join(separator + separator);
  };

  useEffect(() => {
    if (sampleCardsQuery.data != undefined) {
      setPlaceholderText(formatPlaceholderText(sampleCardsQuery.data));
    }
  }, [sampleCardsQuery.data]);

  const handleSubmitTextModal = () => {
    /**
     * Parse the contents of the modal and add the resultant queries in the desired numbers of instances to the project.
     */

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
    handleCloseTextModal();
  };

  return (
    <>
      <Dropdown.Item onClick={handleShowTextModal}>
        <RightPaddedIcon bootstrapIconName="card-text" /> Text
      </Dropdown.Item>
      <Modal
        show={showTextModal}
        onHide={handleCloseTextModal}
        onExited={() => setTextModalValue("")}
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
          <Form.Group className="mb-3">
            <Form.Control
              as="textarea"
              rows={12}
              placeholder={placeholderText}
              required={true}
              onChange={(event) => setTextModalValue(event.target.value)}
              value={textModalValue}
              aria-label="import-text"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseTextModal}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitTextModal}
            aria-label="import-text-submit"
          >
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
