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
import { DropzoneRootProps, useDropzone } from "react-dropzone";

import {
  Card,
  Cardback,
  FaceSeparator,
  ProjectName,
  ReversedCardTypePrefixes,
  SelectedImageSeparator,
  Token,
} from "@/common/constants";
import { DropzoneContainer } from "@/common/dropzone";
import {
  convertLinesIntoSlotProjectMembers,
  formatPlaceholderText,
  processStringAsMultipleLines,
} from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { toTitleCase } from "@/common/utils";
import { RightPaddedIcon } from "@/components/icon";
import {
  useGetDFCPairsQuery,
  useGetSampleCardsQuery,
  useGetTagsQuery,
} from "@/store/api";
import { addMembers, selectProjectSize } from "@/store/slices/projectSlice";
import { selectFuzzySearch } from "@/store/slices/searchSettingsSlice";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";

interface ImportLocalFileProps {
  onImportComplete?: () => void;
}

export function ImportLocalFile({ onImportComplete }: ImportLocalFileProps) {
  const dispatch = useAppDispatch();
  const { clientSearchService, forceUpdate } = useClientSearchContext();
  const getTagsQuery = useGetTagsQuery();

  const onDrop = async (files: Array<File>) => {
    const filesWithIdentifiers = files.map((file) => ({
      identifier: Math.random().toString(),
      file: file,
    }));
    await clientSearchService.indexLocalFiles(
      dispatch,
      forceUpdate,
      filesWithIdentifiers,
      getTagsQuery.data
    );
    dispatch(
      addMembers({
        members: filesWithIdentifiers.map(({ identifier }) => ({
          front: {
            query: { query: identifier, cardType: Card },
            selectedImage: undefined,
            selected: false,
          },
          back: {
            query: { query: null, cardType: Cardback },
            selectedImage: undefined,
            selected: false,
          },
        })),
      })
    );

    if (onImportComplete) {
      onImportComplete();
    }
  };

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
      },
      multiple: true,
    });

  return (
    <>
      <p>Upload image files to add them to your project!</p>
      <hr />
      <p>
        <b>Hint</b>: This works best for <b>one-off</b> files.
      </p>
      <p>
        For many files or more advanced use cases, add a local folder through
        the <b>Sources</b> menu in the top-right.
      </p>
      <div className="container">
        <DropzoneContainer
          {...getRootProps({ isFocused, isDragAccept, isDragReject })}
          aria-label={"upload-local-file-dropzone"}
        >
          <input {...getInputProps()} />
          Drag and drop a file here, or click to select a file.
        </DropzoneContainer>
      </div>
    </>
  );
}

export function ImportLocalFileButton() {
  const [show, setShow] = useState<boolean>(false);
  const focusRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <Dropdown.Item onClick={() => setShow(true)}>
        <RightPaddedIcon bootstrapIconName="upload" /> Upload
      </Dropdown.Item>
      <Modal
        scrollable
        show={show}
        onEntered={() => focusRef.current?.focus()}
        onHide={() => setShow(false)}
        data-testid="import-local-file"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — Upload</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ImportLocalFile />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            aria-label="import-local-file-close"
            onClick={() => setShow(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
