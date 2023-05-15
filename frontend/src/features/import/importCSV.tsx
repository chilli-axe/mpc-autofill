/**
 * This component is the CSV-based entrypoint for cards into the project editor.
 * The component displays a CSV schema which the uploaded file should follow.
 * A dropzone is exposed for the user to either drag-and-drop or select their file with.
 * Broadly similar to text-based input, but allows specifying the preferred image for each
 * row (front and back) - the image will be selected if included in the search results.
 */

// @ts-ignore // TODO: put a PR into this repo adding types
import { parse } from "lil-csv";
import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";

import { useGetDFCPairsQuery } from "@/app/api";
import { AppDispatch } from "@/app/store";
import { FaceSeparator, SelectedImageSeparator } from "@/common/constants";
import {
  convertLinesIntoSlotProjectMembers,
  processLines,
} from "@/common/processing";
import { addMembers, selectProjectSize } from "@/features/project/projectSlice";

import { TextFileDropzone } from "../dropzone";

const BorderedTable = styled(Table)`
  border-style: solid;
  border-color: #333333;
  border-width: 1px;
`;

const FormattedColumnHeader = styled.th`
  width: 20%;
  text-align: center;
`;
const FormattedColumnData = styled.td`
  width: 20%;
  text-align: center;
`;

// TODO: typescript enums don't allow for reverse lookup :(
enum CSVHeaders {
  quantity = "Quantity",
  frontQuery = "Front",
  frontSelectedImage = "Front ID",
  backQuery = "Back",
  backSelectedImage = "Back ID",
}

function CSVFormat() {
  // TODO: some strings are defined in a few places in this file. consolidate them
  return (
    <>
      <BorderedTable bordered={true}>
        <thead>
          <FormattedColumnHeader>Quantity</FormattedColumnHeader>
          <FormattedColumnHeader>Front</FormattedColumnHeader>
          <FormattedColumnHeader>Front ID</FormattedColumnHeader>
          <FormattedColumnHeader>Back</FormattedColumnHeader>
          <FormattedColumnHeader>Back ID</FormattedColumnHeader>
        </thead>
        <tbody>
          {Array(3).fill(<tr>{Array(5).fill(<FormattedColumnData />)}</tr>)}
        </tbody>
      </BorderedTable>
      Where the columns follow these rules:
      <ul>
        <li>
          <b>Quantity</b>: The quantity to include of this row. Must be greater
          than 0. Can be blank &mdash; if blank, a quantity of 1 will be
          assumed.
        </li>
        <li>
          <b>Front</b>: Search query for card front. <b>Cannot be blank.</b>
        </li>
        <li>
          <b>Front ID</b>: If this image is in the front search results, it will
          be pre-selected. Can be blank.
        </li>
        <li>
          <b>Front</b>: Search query for card back. Can be blank.
        </li>
        <li>
          <b>Front ID</b>: If this image is in the back search results, it will
          be pre-selected. Can be blank.
        </li>
      </ul>
    </>
  );
}

function SampleCSV() {
  return (
    <BorderedTable bordered={true}>
      <thead>
        <FormattedColumnHeader>Quantity</FormattedColumnHeader>
        <FormattedColumnHeader>Front</FormattedColumnHeader>
        <FormattedColumnHeader>Front ID</FormattedColumnHeader>
        <FormattedColumnHeader>Back</FormattedColumnHeader>
        <FormattedColumnHeader>Back ID</FormattedColumnHeader>
      </thead>
      <tbody>
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
      </tbody>
    </BorderedTable>
  );
}

export function ImportCSV() {
  const dispatch = useDispatch<AppDispatch>();
  const dfcPairsQuery = useGetDFCPairsQuery();
  const [showCSVModal, setShowCSVModal] = useState(false);
  const handleCloseCSVModal = () => setShowCSVModal(false);
  const handleShowCSVModal = () => setShowCSVModal(true);

  const projectSize = useSelector(selectProjectSize);

  const parseCSVFile = (fileContents: string | ArrayBuffer | null) => {
    if (typeof fileContents !== "string") {
      alert("invalid CSV file uploaded");
      // TODO: error messaging to the user that they've uploaded an invalid file
      return;
    }
    const quantityProperty = "quantity";
    const frontQueryProperty = "frontQuery";
    const frontSelectedImageProperty = "frontSelectedImage";
    const backQueryProperty = "backQuery";
    const backSelectedImageProperty = "backSelectedImage";

    const rows = parse(fileContents, {
      header: {
        Quantity: quantityProperty,
        Front: frontQueryProperty,
        "Front ID": frontSelectedImageProperty,
        Back: backQueryProperty,
        "Back ID": backSelectedImageProperty,
      },
    });

    const formatCSVRowAsLine = (x: any): string => {
      let formattedLine = `${x[quantityProperty] ?? ""} ${
        x[frontQueryProperty] ?? ""
      }`;
      if ((x[frontSelectedImageProperty] ?? "").length > 0) {
        formattedLine += `${SelectedImageSeparator}${x[frontSelectedImageProperty]}`;
      }
      if ((x[backQueryProperty] ?? "").length > 0) {
        formattedLine += ` ${FaceSeparator} ${x[backQueryProperty]}`;
        if ((x[backSelectedImageProperty] ?? "").length > 0) {
          formattedLine += `${SelectedImageSeparator}${x[backSelectedImageProperty]}`;
        }
      }
      return formattedLine;
    };

    const processedLines = processLines(
      rows.map(formatCSVRowAsLine),
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
    handleCloseCSVModal();
  };

  return (
    <>
      <Dropdown.Item onClick={handleShowCSVModal}>
        <i
          className="bi bi-file-earmark-spreadsheet"
          style={{ paddingRight: 0.5 + "em" }}
        />{" "}
        CSV
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
