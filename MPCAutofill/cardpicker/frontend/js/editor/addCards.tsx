// TODO: this file is four distinct components rolled into one. split it out appropriately.

import { useDispatch } from "react-redux";

import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import React, { useState, useEffect, ReactNode } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import { processLine } from "./utils";
import { addImages } from "./projectSlice";
import { AppDispatch } from "./store";
import Cookies from "js-cookie";

interface ImportSite {
  name: string;
  url: string;
}

export function AddCards() {
  const dispatch = useDispatch<AppDispatch>();
  const [showTextModal, setShowTextModal] = useState(false);
  const handleCloseTextModal = () => setShowTextModal(false);
  const handleShowTextModal = () => setShowTextModal(true);
  const [textModalValue, setTextModalValue] = useState("");

  const handleSubmitTextModal = () => {
    let queriesToQuantity: { [query: string]: number } = {};
    textModalValue.split(/\r?\n|\r|\n/g).forEach((line) => {
      if (line != null && line.trim().length > 0) {
        const [query, quantity] = processLine(line);
        queriesToQuantity[query] = (queriesToQuantity[query] ?? 0) + quantity;
      }
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
  const [URLModalValue, setURLModalValue] = useState("");
  const [importSites, setImportSites] = useState(null);

  useEffect(() => {
    const fetchImportSites = async () => {
      const rawResponse = await fetch("/2/getImportSites", {
        method: "GET", // TODO: double check that other requests are using GET instead of POST appropriately
        credentials: "same-origin",
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken"),
        },
      });
      const content = await rawResponse.json();
      // TODO: this is mad unsafe
      setImportSites(content["import_sites"]);
    };

    fetchImportSites();
  }, []);

  const handleSubmitURLModal = async () => {
    // TODO: propagate the custom site name through to the new frontend
    // TODO: provide some feedback that this is in progress
    const rawResponse = await fetch("/2/queryImportSite/", {
      method: "POST",
      body: JSON.stringify({ url: URLModalValue }),
      credentials: "same-origin",
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken"),
      },
    });
    const content = await rawResponse.json();

    // TODO: reuse this snippet in a function
    let queriesToQuantity: { [query: string]: number } = {};
    content["cards"].split(/\r?\n|\r|\n/g).forEach((line: string) => {
      if (line != null && line.trim().length > 0) {
        const [query, quantity] = processLine(line);
        queriesToQuantity[query] = (queriesToQuantity[query] ?? 0) + quantity;
      }
    });

    dispatch(addImages(queriesToQuantity));
    handleCloseURLModal();
  };

  let importSitesElement = (
    <>
      <br />
      <div className="d-flex justify-content-center align-items-center">
        <div
          className="spinner-border"
          style={{ width: 4 + "em", height: 4 + "em" }}
          role="status"
        >
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
      <br />
    </>
  );
  if (importSites != null) {
    importSitesElement = (
      <ul>
        {importSites.map((importSite: ImportSite) => (
          <li>
            <a href={importSite.url} target="_blank">
              {importSite.name}
            </a>
          </li>
        ))}
      </ul>
    );
  }

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

      <Modal
        show={showURLModal}
        onHide={handleCloseURLModal}
        onExited={() => setURLModalValue("")}
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — URL</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Paste a link to a card list hosted on one of the below sites (not
          affiliated) to import the list into MPC Autofill:
          <br />
          {importSitesElement}
          <Form.Group className="mb-3">
            <Form.Control
              type={"url"}
              required={true}
              placeholder="https://"
              onChange={(event) => setURLModalValue(event.target.value)}
              value={URLModalValue}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseURLModal}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await handleSubmitURLModal();
            }}
          >
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
