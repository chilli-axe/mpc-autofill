/**
 * This component is the text-based entrypoint for cards into the project editor
 * (probably the primary way that users upload cards).
 * A freeform text area is exposed and the cards are processed when the user hits Submit.
 */

import React, {
  FormEvent,
  KeyboardEvent,
  KeyboardEventHandler,
  useRef,
  useState,
} from "react";
import { Accordion } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Stack from "react-bootstrap/Stack";

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
import { useGetDFCPairsQuery, useGetSampleCardsQuery } from "@/store/api";
import { addMembers, selectProjectSize } from "@/store/slices/projectSlice";
import { selectFuzzySearch } from "@/store/slices/searchSettingsSlice";

interface ImportTextProps {
  onImportComplete?: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  textValue?: string;
  onTextChange?: (value: string) => void;
}

export function ImportText({
  onImportComplete,
  textareaRef,
  textValue: controlledTextValue,
  onTextChange,
}: ImportTextProps) {
  const dispatch = useAppDispatch();
  const sampleCardsQuery = useGetSampleCardsQuery();
  const dfcPairsQuery = useGetDFCPairsQuery();
  const fuzzySearch = useAppSelector(selectFuzzySearch);
  const projectSize = useAppSelector(selectProjectSize);

  const [internalTextValue, setInternalTextValue] = useState<string>("");
  const textValue = controlledTextValue ?? internalTextValue;
  const setTextValue = onTextChange ?? setInternalTextValue;
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? internalRef;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const processedLines = processStringAsMultipleLines(
      textValue,
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
    setTextValue("");
    onImportComplete?.();
  };

  const onKeyDown: KeyboardEventHandler = (e: KeyboardEvent): void => {
    if (e.ctrlKey && e.code === "Enter" && ref.current?.form) {
      ref.current.form.requestSubmit();
    }
  };

  const disabled = dfcPairsQuery.isFetching;
  const placeholderText =
    sampleCardsQuery.data != null
      ? formatPlaceholderText(sampleCardsQuery.data)
      : "";

  return (
    <>
      <p>
        Type the names of the cards you&apos;d like to add to your order and hit{" "}
        <b>Submit</b>. One card per line.
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
                <code>{ReversedCardTypePrefixes[Token]}</code> at the start of
                the query &mdash; for example,{" "}
                <code>
                  {ReversedCardTypePrefixes[Token]}your {Token.toLowerCase()}{" "}
                  name
                </code>
                .
              </li>
              <li>
                Search for <b>{Cardback.toLowerCase()}s</b> by putting{" "}
                <code>{ReversedCardTypePrefixes[Cardback]}</code> at the start
                of the query &mdash; for example,{" "}
                <code>
                  {ReversedCardTypePrefixes[Cardback]}your{" "}
                  {Cardback.toLowerCase()} name
                </code>
                .
              </li>
              <li>
                You may optionally specify the image ID to select by typing your
                search query, <code>{SelectedImageSeparator}</code>, then the
                image ID — for example,{" "}
                <code>
                  your {Card.toLowerCase()} name{SelectedImageSeparator}
                  1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5
                </code>
                .
              </li>
              <li>
                You may specify queries for both the front and the back by
                separating them with <code>{FaceSeparator}</code> — for example,{" "}
                <code>
                  4x goblin {FaceSeparator} {ReversedCardTypePrefixes[Token]}
                  elf
                </code>
                .
              </li>
              <li>
                If you don&apos;t specify a back query and your front query is a
                double-faced card, we will automatically query the back card for
                you.
              </li>
            </ul>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
      <br />
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Control
            ref={ref}
            as="textarea"
            onKeyDown={onKeyDown}
            rows={12}
            placeholder={placeholderText}
            required={true}
            onChange={(event) => setTextValue(event.target.value)}
            value={textValue}
            aria-label="import-text"
          />
        </Form.Group>
        <Stack direction="horizontal" gap={1}>
          <p>
            <i>Hint: Submit with Control+Enter.</i>
          </p>
          <div className="ms-auto">
            <Button
              type="submit"
              variant="primary"
              aria-label="import-text-submit"
              disabled={disabled}
            >
              Submit
            </Button>
          </div>
        </Stack>
      </Form>
    </>
  );
}

export function ImportTextButton() {
  const [show, setShow] = useState<boolean>(false);
  const [textValue, setTextValue] = useState<string>("");
  const focusRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <Dropdown.Item onClick={() => setShow(true)}>
        <RightPaddedIcon bootstrapIconName="card-text" /> Text
      </Dropdown.Item>
      <Modal
        scrollable
        show={show}
        onEntered={() => focusRef.current?.focus()}
        onHide={() => setShow(false)}
        data-testid="import-text"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — Text</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ImportText
            onImportComplete={() => setShow(false)}
            textareaRef={focusRef}
            textValue={textValue}
            onTextChange={setTextValue}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            aria-label="import-text-close"
            onClick={() => setShow(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
