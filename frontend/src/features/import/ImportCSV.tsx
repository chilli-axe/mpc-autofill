/**
 * This component is the CSV-based entrypoint for cards into the project editor.
 * The component displays a CSV schema which the uploaded file should follow.
 * A dropzone is exposed for the user to either drag-and-drop or select their file with.
 * Supports the same functionality as text-based input, but users might prefer this
 * for repeatability.
 */

import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";

import { CSVHeaders } from "@/common/constants";
import { TextFileDropzone } from "@/common/dropzone";
import {
  convertLinesIntoSlotProjectMembers,
  parseCSVFileAsLines,
  processLines,
} from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { AutofillTable } from "@/components/AutofillTable";
import { RightPaddedIcon } from "@/components/icon";
import { useGetDFCPairsQuery } from "@/store/api";
import { addMembers, selectProjectSize } from "@/store/slices/projectSlice";
import { selectFuzzySearch } from "@/store/slices/searchSettingsSlice";
import { setNotification } from "@/store/slices/toastsSlice";

/**
 * Instruct the user on how to format their CSV files.
 */
function CSVFormat() {
  return (
    <>
      <AutofillTable
        headers={Object.values(CSVHeaders)}
        data={Array(3).fill(Array(5).fill(null))}
        bordered={true}
        uniformWidth={true}
      />
      Where the columns follow these rules:
      <ul>
        <li>
          <b>{CSVHeaders.quantity}</b>: The quantity to include of this row.
          Must be greater than 0. Can be blank &mdash; if blank, a quantity of 1
          will be assumed.
        </li>
        <li>
          <b>{CSVHeaders.frontQuery}</b>: Search query for card front.{" "}
          <b>Cannot be blank.</b>
        </li>
        <li>
          <b>{CSVHeaders.frontSelectedImage}</b>: If this image is in the front
          search results, it will be pre-selected. Can be blank.
        </li>
        <li>
          <b>{CSVHeaders.backQuery}</b>: Search query for card back. Can be
          blank.
        </li>
        <li>
          <b>{CSVHeaders.backSelectedImage}</b>: If this image is in the back
          search results, it will be pre-selected. Can be blank.
        </li>
      </ul>
    </>
  );
}

function SampleCSV() {
  return (
    <AutofillTable
      headers={Object.values(CSVHeaders)}
      data={[
        [
          <code key="row-1-quantity">2</code>,
          <code key="row-1-front-query">island</code>,
          <code key="row-1-front-id">1HsvTYs...</code>,
          <code key="row-1-back-query">forest</code>,
          null,
        ],
        [
          <code key="row-2-quantity">3</code>,
          <code key="row-2-front-query">t:goblin</code>,
          null,
          null,
          <code key="row-2-back-id">1JtXL6C...</code>,
        ],
      ]}
      bordered={true}
    />
  );
}

interface ImportCSVProps {
  onImportComplete?: () => void;
}

export function ImportCSV({ onImportComplete }: ImportCSVProps) {
  const dispatch = useAppDispatch();
  const dfcPairsQuery = useGetDFCPairsQuery();
  const fuzzySearch = useAppSelector(selectFuzzySearch);
  const projectSize = useAppSelector(selectProjectSize);

  const parseCSVFile = (fileContents: string | ArrayBuffer | null) => {
    if (typeof fileContents !== "string") {
      dispatch(
        setNotification([
          "invalid-csv-contents",
          {
            name: "Invalid CSV file",
            message:
              "The contents of the uploaded file did not match the expected text format.",
            level: "error",
          },
        ])
      );
      return;
    }

    const lines = parseCSVFileAsLines(fileContents);
    const processedLines = processLines(
      lines,
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
    onImportComplete?.();
  };

  const disabled = dfcPairsQuery.isFetching;

  return (
    <>
      <p>
        Upload a CSV file of cards to add to the project. The file must{" "}
        <b>exactly</b> match the following format:
      </p>
      <CSVFormat />
      For example:
      <SampleCSV />
      <hr />
      <TextFileDropzone
        mimeTypes={{ "text/csv": [".csv"] }}
        fileUploadCallback={parseCSVFile}
        label="import-csv"
        disabled={disabled}
      />
    </>
  );
}

export function ImportCSVButton() {
  const [show, setShow] = useState<boolean>(false);

  return (
    <>
      <Dropdown.Item onClick={() => setShow(true)}>
        <RightPaddedIcon bootstrapIconName="file-earmark-spreadsheet" /> CSV
      </Dropdown.Item>
      <Modal
        scrollable
        show={show}
        onHide={() => setShow(false)}
        data-testid="import-csv"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — CSV</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ImportCSV onImportComplete={() => setShow(false)} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShow(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
