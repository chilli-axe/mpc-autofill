/**
 * This component is the text-based entrypoint for cards into the project editor
 * (probably the primary way that users upload cards).
 * A freeform text area is exposed and the cards are processed when the user hits Submit.
 */

import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";

import { useGetDFCPairsQuery, useGetSampleCardsQuery } from "@/app/api";
import { AppDispatch } from "@/app/store";
import {
  Card,
  Cardback,
  FaceSeparator,
  ReversedCardTypePrefixes,
  SelectedImageSeparator,
  Token,
} from "@/common/constants";
import {
  convertLinesIntoSlotProjectMembers,
  processStringAsMultipleLines,
  stripTextInParentheses,
} from "@/common/processing";
import { CardDocument } from "@/common/types";
import { addMembers, selectProjectSize } from "@/features/project/projectSlice";
import { fetchCardDocuments } from "@/features/search/cardDocumentsSlice";

export function ImportText() {
  // TODO: add an accordion here for explaining how to search for each different card type with prefixes
  const sampleCardsQuery = useGetSampleCardsQuery();
  const dfcPairsQuery = useGetDFCPairsQuery();

  const dispatch = useDispatch<AppDispatch>();
  const [showTextModal, setShowTextModal] = useState(false);
  const handleCloseTextModal = () => setShowTextModal(false);
  const handleShowTextModal = () => setShowTextModal(true);
  const [textModalValue, setTextModalValue] = useState("");
  const [placeholderText, setPlaceholderText] = useState("");

  const projectSize = useSelector(selectProjectSize);

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
      dfcPairsQuery.data ?? {}
    );
    dispatch(
      addMembers({
        members: convertLinesIntoSlotProjectMembers(
          processedLines,
          projectSize
        ),
      })
    );
    dispatch(fetchCardDocuments());
    handleCloseTextModal();
  };

  return (
    <>
      <Dropdown.Item onClick={handleShowTextModal}>
        <i className="bi bi-card-text" style={{ paddingRight: 0.5 + "em" }} />{" "}
        Text
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
          <p>
            Specify both front and back queries by separating them with{" "}
            <code>{FaceSeparator}</code> — for example,{" "}
            <code>
              4x goblin {FaceSeparator} {ReversedCardTypePrefixes[Token]}elf
            </code>
            .
          </p>
          <p>
            You may optionally specify the image ID to select with{" "}
            <code>{SelectedImageSeparator}</code> — for example,{" "}
            <code>
              brainstorm{SelectedImageSeparator}
              1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5
            </code>
          </p>
          <p>
            If you don&apos;t specify a back query and your front query is a
            double-faced card, we will automatically query the back for you.
          </p>
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
