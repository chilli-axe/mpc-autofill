import React, { useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import { DFCPairs } from "../../common/types";
import { TextFileDropzone } from "../dropzone";
import Table from "react-bootstrap/Table";

interface AddCardsByCSVProps {
  dfcPairs: DFCPairs;
}

export function AddCardsByCSV(props: AddCardsByCSVProps) {
  const [showCSVModal, setShowCSVModal] = useState(false);
  const handleCloseCSVModal = () => setShowCSVModal(false);
  const handleShowCSVModal = () => setShowCSVModal(true);

  const myCallback = (fileContents: string) => {
    console.log("file received!");
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
      <Modal show={showCSVModal} onHide={handleCloseCSVModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — CSV</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Upload a CSV file of cards to add to the project. The file must
            match the following format:
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
              <th>Quantity</th>
              <th>Front</th>
              <th>Back</th>
            </thead>
            <tbody>
              {Array(3).fill(
                <tr>
                  <td style={{ width: 20 + "%" }} />
                  <td style={{ width: 40 + "%" }} />
                  <td style={{ width: 40 + "%" }} />
                </tr>
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
              <th>Quantity</th>
              <th>Front</th>
              <th>Back</th>
            </thead>
            <tbody>
              <tr>
                <td style={{ width: 20 + "%" }}>
                  <code>2</code>
                </td>
                <td style={{ width: 40 + "%" }}>
                  <code>island</code>
                </td>
                <td style={{ width: 40 + "%" }}>
                  <code>forest</code>
                </td>
              </tr>
              <tr>
                <td style={{ width: 20 + "%" }}>
                  <code>3</code>
                </td>
                <td style={{ width: 40 + "%" }}>
                  <code>t:goblin</code>
                </td>
                <td style={{ width: 40 + "%" }} />
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
