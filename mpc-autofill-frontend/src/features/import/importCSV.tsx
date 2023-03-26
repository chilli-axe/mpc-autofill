import React, { CSSProperties, useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import { DFCPairs } from "../../common/types";
import { TextFileDropzone } from "../dropzone";
import Table from "react-bootstrap/Table";

interface ImportCSVProps {
  dfcPairs: DFCPairs;
}

export function ImportCSV(props: ImportCSVProps) {
  const [showCSVModal, setShowCSVModal] = useState(false);
  const handleCloseCSVModal = () => setShowCSVModal(false);
  const handleShowCSVModal = () => setShowCSVModal(true);

  const myCallback = (fileContents: string) => {
    console.log("file received!");
  };

  const columnStyle: CSSProperties = { width: 20 + "%", textAlign: "center" };

  return (
    <>
      <Dropdown.Item onClick={handleShowCSVModal}>
        <i
          className="bi bi-file-earmark-spreadsheet"
          style={{ paddingRight: 0.5 + "em" }}
        />{" "}
        CSV
      </Dropdown.Item>
      <Modal show={showCSVModal} onHide={handleCloseCSVModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — CSV</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Upload a CSV file of cards to add to the project. The file must{" "}
            <b>exactly</b> match the following format:
          </p>
          <Table
            bordered={true}
            style={{
              borderStyle: "solid",
              borderColor: "#333333",
              borderWidth: 1 + "px",
            }}
          >
            <thead>
              <th style={columnStyle}>Quantity</th>
              <th style={columnStyle}>Front</th>
              <th style={columnStyle}>Front ID</th>
              <th style={columnStyle}>Back</th>
              <th style={columnStyle}>Back ID</th>
            </thead>
            <tbody>
              {Array(3).fill(
                <tr>{Array(5).fill(<td style={{ width: 20 + "%" }} />)}</tr>
              )}
            </tbody>
          </Table>
          For example:
          <Table
            bordered={true}
            style={{
              borderStyle: "solid",
              borderColor: "#333333",
              borderWidth: 1 + "px",
            }}
          >
            <thead>
              <th style={columnStyle}>Quantity</th>
              <th style={columnStyle}>Front</th>
              <th style={columnStyle}>Front ID</th>
              <th style={columnStyle}>Back</th>
              <th style={columnStyle}>Back ID</th>
            </thead>
            <tbody>
              <tr>
                <td style={columnStyle}>
                  <code>2</code>
                </td>
                <td style={columnStyle}>
                  <code>island</code>
                </td>
                <td style={columnStyle}>
                  <code>1HsvTYs1...</code>
                </td>
                <td style={columnStyle}>
                  <code>forest</code>
                </td>
                <td style={columnStyle} />
              </tr>
              <tr>
                <td style={columnStyle}>
                  <code>3</code>
                </td>
                <td style={columnStyle}>
                  <code>t:goblin</code>
                </td>
                <td style={columnStyle} />
                <td style={columnStyle} />
                <td style={columnStyle}>
                  <code>1JtXL6Ca...</code>
                </td>
              </tr>
            </tbody>
          </Table>
          <TextFileDropzone
            mimeTypes={{ "text/csv": [".csv"] }}
            callback={myCallback}
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
