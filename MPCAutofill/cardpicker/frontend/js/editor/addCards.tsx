import { useDispatch } from "react-redux";

import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import React, { useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import { processLine } from "./utils";
import { addImages } from "./projectSlice";
import { AppDispatch } from "./store";

export function AddCards() {
  const dispatch = useDispatch<AppDispatch>();
  const [showTextModal, setShowTextModal] = useState(false);
  const handleCloseTextModal = () => setShowTextModal(false);
  const handleShowTextModal = () => setShowTextModal(true);
  const [textModalValue, setTextModalValue] = useState("");

  const handleSubmitTextModal = () => {
    let queriesToQuantity: { [query: string]: number } = {};
    textModalValue.split(/\r?\n|\r|\n/g).forEach((line) => {
      const [query, quantity] = processLine(line);
      queriesToQuantity[query] = (queriesToQuantity[query] ?? 0) + quantity;
    });

    dispatch(addImages(queriesToQuantity));
    handleCloseTextModal();
  };

  const [showXMLModal, setShowXMLModal] = useState(false);
  const handleCloseXMLModal = () => setShowXMLModal(false);
  const handleShowXMLModal = () => setShowXMLModal(true);

  const [showCSVModal, setShowCSVModal] = useState(false);
  const handleCloseCSVModal = () => setShowCSVModal(false);
  const handleShowCSVModal = () => setShowCSVModal(true);

  const [showURLModal, setShowURLModal] = useState(false);
  const handleCloseURLModal = () => setShowURLModal(false);
  const handleShowURLModal = () => setShowURLModal(true);

  return (
    <>
      <Dropdown>
        <div className="d-grid gap-0">
          <Dropdown.Toggle variant="success" id="dropdown-basic">
            <i
              className="bi bi-plus-circle"
              style={{ paddingRight: 0.5 + "em" }}
            />{" "}
            Add Cards
          </Dropdown.Toggle>
        </div>

        <Dropdown.Menu>
          <Dropdown.Item onClick={handleShowTextModal}>
            <i
              className="bi bi-card-text"
              style={{ paddingRight: 0.5 + "em" }}
            />{" "}
            Text
          </Dropdown.Item>
          <Dropdown.Item onClick={handleShowXMLModal}>
            <i
              className="bi bi-file-code"
              style={{ paddingRight: 0.5 + "em" }}
            />{" "}
            XML
          </Dropdown.Item>
          <Dropdown.Item onClick={handleShowCSVModal}>
            <i
              className="bi bi-file-earmark-spreadsheet"
              style={{ paddingRight: 0.5 + "em" }}
            />{" "}
            CSV
          </Dropdown.Item>
          <Dropdown.Item onClick={handleShowURLModal}>
            <i
              className="bi bi-link-45deg"
              style={{ paddingRight: 0.5 + "em" }}
            />{" "}
            URL
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      <Modal
        show={showTextModal}
        onHide={handleCloseTextModal}
        onExited={() => setTextModalValue("")}
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — Text</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Type the names of the cards you'd like to add to your order and hit{" "}
            <b>Submit</b>. One card per line.
          </p>
          <Form.Group className="mb-3" controlId="exampleForm.ControlTextarea1">
            <Form.Control
              as="textarea"
              rows={12} // TODO: let's retrieve this placeholder string from the backend
              placeholder="4x Lion's Eye Diamond&#10;4x Golgari Grave-Troll&#10;4x Bridge from Below&#10;3x Breakthrough&#10;&#10;6x t:Zombie"
              onChange={(event) => setTextModalValue(event.target.value)}
              value={textModalValue}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseTextModal}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSubmitTextModal}>
            Submit
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showXMLModal} onHide={handleCloseXMLModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — XML</Modal.Title>
        </Modal.Header>
        <Modal.Body>In Progress</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseXMLModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCSVModal} onHide={handleCloseCSVModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — CSV</Modal.Title>
        </Modal.Header>
        <Modal.Body>In Progress</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseCSVModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showURLModal} onHide={handleCloseURLModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — URL</Modal.Title>
        </Modal.Header>
        <Modal.Body>In Progress</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseURLModal}>
            Close
          </Button>
          <Button variant="primary" onClick={handleCloseURLModal}>
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
