import { fetchSourceDocuments } from "./sourceDocumentsSlice";

require("bootstrap-icons/font/bootstrap-icons.css");
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "./store";

export function SearchSettings() {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    dispatch(fetchSourceDocuments());
  }, [dispatch]);

  return (
    <div className="d-grid gap-2">
      <Button variant={"primary"} onClick={handleShow}>
        <i className="bi bi-gear" style={{ paddingRight: 0.5 + "em" }} />
        Search Settings
      </Button>

      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Search Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Select the sources you'd like to search, and drag & drop them to
          change the order images are shown in.
          <br />
          Click the table header to enable or disable all sources.
          <br />
          <input // TODO: this is broken at the moment.
            type="checkbox"
            id="searchtype"
            data-toggle="toggle"
            data-on="Fuzzy Search"
            data-off="Precise Search"
            data-onstyle="success"
            data-offstyle="info"
            data-width="100%"
            data-height="40px"
            data-size="md"
          />
          <br />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleClose}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
