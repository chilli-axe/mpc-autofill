/**
 * This component is the XML-based entrypoint for cards into the project editor.
 * Projects which have been previously exported as XML can be re-uploaded through
 * this component and their cards will be added to the current project state.
 * A dropzone is exposed for the user to either drag-and-drop or select their file with.
 * The user will be prompted on whether they want to use their uploaded file's
 * finish settings (e.g. foil/nonfoil, the selected cardstock) or retain the project's
 * finish settings.
 */

import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";

import { TextFileDropzone } from "../dropzone";

export function ImportXML() {
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
