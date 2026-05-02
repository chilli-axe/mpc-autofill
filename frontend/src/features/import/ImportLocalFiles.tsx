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

interface ImportLocalFilesProps {
  onImportComplete?: () => void;
}

export function ImportLocalFiles({ onImportComplete }: ImportLocalFilesProps) {
  return <>hello world!</>;
}

export function ImportLocalFilesButton() {
  const [show, setShow] = useState<boolean>(false);

  return (
    <>
      <Dropdown.Item onClick={() => setShow(true)}>
        <RightPaddedIcon bootstrapIconName="upload" /> Local Files
      </Dropdown.Item>
      <Modal
        scrollable
        show={show}
        onHide={() => setShow(false)}
        data-testid="import-local-files"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — Local Files</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ImportLocalFiles onImportComplete={() => setShow(false)} />
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
