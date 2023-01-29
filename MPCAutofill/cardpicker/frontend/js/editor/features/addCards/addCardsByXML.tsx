import React, { useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import { TextFileDropzone } from "../dropzone";

export function AddCardsByXML() {
  const [showXMLModal, setShowXMLModal] = useState(false);
  const handleCloseXMLModal = () => setShowXMLModal(false);
  const handleShowXMLModal = () => setShowXMLModal(true);

  const myCallback = (fileContents: string) => {
    console.log("file received!");
  };

  return (
    <>
      <Dropdown.Item onClick={handleShowXMLModal}>
        <i className="bi bi-file-code" style={{ paddingRight: 0.5 + "em" }} />{" "}
        XML
      </Dropdown.Item>
      <Modal show={showXMLModal} onHide={handleCloseXMLModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — XML</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <TextFileDropzone
            mimeTypes={{ "text/xml": [".xml"] }}
            callback={myCallback}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseXMLModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
