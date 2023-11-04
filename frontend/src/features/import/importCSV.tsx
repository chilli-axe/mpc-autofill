/**
 * This component is the CSV-based entrypoint for cards into the project editor.
 * The component displays a CSV schema which the uploaded file should follow.
 * A dropzone is exposed for the user to either drag-and-drop or select their file with.
 * Supports the same functionality as text-based input, but users might prefer this
 * for repeatability.
 */

// @ts-ignore // TODO: put a PR into this repo adding types
import { parse } from "lil-csv";
import React, { PropsWithChildren, useState } from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import styled from "styled-components";

import { useGetDFCPairsQuery } from "@/app/api";
import { FaceSeparator, SelectedImageSeparator } from "@/common/constants";
import { TextFileDropzone } from "@/common/dropzone";
import {
  convertLinesIntoSlotProjectMembers,
  processLines,
} from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { BorderedTable, TableWrapper } from "@/components/table";
import { addMembers, selectProjectSize } from "@/features/project/projectSlice";
import { selectFuzzySearch } from "@/features/searchSettings/searchSettingsSlice";
import { setError } from "@/features/toasts/toastsSlice";

const FormattedColumnHeader = styled.th`
  width: 20%;
  text-align: center;
`;
const FormattedColumnData = styled.td`
  width: 20%;
  text-align: center;
`;

const CSVHeaders: { [key: string]: string } = {
  quantity: "Quantity",
  frontQuery: "Front",
  frontSelectedImage: "Front ID",
  backQuery: "Back",
  backSelectedImage: "Back ID",
};

function CSVTable({ children }: PropsWithChildren) {
  /**
   * A simple component for representing the CSV format.
   */

  return (
    <TableWrapper>
      <BorderedTable bordered={true}>
        <thead>
          {Object.values(CSVHeaders).map((column) => (
            <FormattedColumnHeader key={column}>{column}</FormattedColumnHeader>
          ))}
        </thead>
        <tbody>{children}</tbody>
      </BorderedTable>
    </TableWrapper>
  );
}

function CSVFormat() {
  /**
   * Instruct the user on how to format their CSV files.
   */

  return (
    <>
      <CSVTable>
        {Array(3).fill(<tr>{Array(5).fill(<FormattedColumnData />)}</tr>)}
      </CSVTable>
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
    <CSVTable>
      <tr>
        <FormattedColumnData>
          <code>2</code>
        </FormattedColumnData>
        <FormattedColumnData>
          <code>island</code>
        </FormattedColumnData>
        <FormattedColumnData>
          <code>1HsvTYs1...</code>
        </FormattedColumnData>
        <FormattedColumnData>
          <code>forest</code>
        </FormattedColumnData>
        <FormattedColumnData />
      </tr>
      <tr>
        <FormattedColumnData>
          <code>3</code>
        </FormattedColumnData>
        <FormattedColumnData>
          <code>t:goblin</code>
        </FormattedColumnData>
        <FormattedColumnData />
        <FormattedColumnData />
        <FormattedColumnData>
          <code>1JtXL6Ca...</code>
        </FormattedColumnData>
      </tr>
    </CSVTable>
  );
}

export function ImportCSV() {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const dfcPairsQuery = useGetDFCPairsQuery();
  const fuzzySearch = useAppSelector(selectFuzzySearch);
  const projectSize = useAppSelector(selectProjectSize);

  //# endregion

  //# region state

  const [showCSVModal, setShowCSVModal] = useState<boolean>(false);

  //# endregion

  //# region callbacks

  const handleCloseCSVModal = () => setShowCSVModal(false);
  const handleShowCSVModal = () => setShowCSVModal(true);
  const parseCSVFile = (fileContents: string | ArrayBuffer | null) => {
    if (typeof fileContents !== "string") {
      dispatch(
        setError([
          "invalid-csv-contents",
          {
            name: "Invalid CSV file",
            message:
              "The contents of the uploaded file did not match the expected text format.",
          },
        ])
      );
      return;
    }

    const rows = parse(fileContents, {
      header: Object.fromEntries(
        Object.entries(CSVHeaders).map(([key, value]) => [value, key])
      ),
    });
    const formatCSVRowAsLine = (x: {
      quantity: string | null;
      frontQuery: string | null;
      frontSelectedImage: string | null;
      backQuery: string | null;
      backSelectedImage: string | null;
    }): string => {
      let formattedLine = `${x.quantity ?? ""} ${x.frontQuery ?? ""}`;
      if ((x.frontSelectedImage ?? "").length > 0) {
        formattedLine += `${SelectedImageSeparator}${x.frontSelectedImage}`;
      }
      if ((x.backQuery ?? "").length > 0) {
        formattedLine += ` ${FaceSeparator} ${x.backQuery}`;
        if ((x.backSelectedImage ?? "").length > 0) {
          formattedLine += `${SelectedImageSeparator}${x.backSelectedImage}`;
        }
      }
      return formattedLine;
    };

    const processedLines = processLines(
      rows.map(formatCSVRowAsLine),
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
    handleCloseCSVModal();
  };

  //# endregion

  //# region computed constants

  const disabled = dfcPairsQuery.isFetching;

  //# endregion

  return (
    <>
      <Dropdown.Item onClick={handleShowCSVModal}>
        <RightPaddedIcon bootstrapIconName="file-earmark-spreadsheet" /> CSV
      </Dropdown.Item>
      <Modal
        show={showCSVModal}
        onHide={handleCloseCSVModal}
        data-testid="import-csv"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — CSV</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseCSVModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
