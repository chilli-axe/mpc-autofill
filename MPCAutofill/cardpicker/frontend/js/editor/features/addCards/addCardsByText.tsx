import { useDispatch } from "react-redux";
import { AppDispatch } from "../../app/store";
import React, { useState } from "react";
import { processLines } from "../../common/utils";
import { addImages } from "../project/projectSlice";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";

export function AddCardsByText() {
  const dispatch = useDispatch<AppDispatch>();
  const [showTextModal, setShowTextModal] = useState(false);
  const handleCloseTextModal = () => setShowTextModal(false);
  const handleShowTextModal = () => setShowTextModal(true);
  const [textModalValue, setTextModalValue] = useState("");

  const handleSubmitTextModal = () => {
    /**
     * Parse the contents of the modal and add the resultant queries in the desired numbers of instances to the project.
     */

    const aggregatedQueries = processLines(textModalValue);
    dispatch(addImages(aggregatedQueries));
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
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — Text</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Type the names of the cards you'd like to add to your order and hit{" "}
            <b>Submit</b>. One card per line.
          </p>
          <Form.Group className="mb-3">
            <Form.Control
              as="textarea"
              rows={12} // TODO: let's retrieve this placeholder string from the backend
              placeholder="4x Lion's Eye Diamond&#10;4x Golgari Grave-Troll&#10;4x Bridge from Below&#10;3x Breakthrough&#10;&#10;6x t:Zombie"
              required={true}
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
    </>
  );
}
