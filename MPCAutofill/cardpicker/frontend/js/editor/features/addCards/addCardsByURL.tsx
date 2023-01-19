import { useDispatch } from "react-redux";
import { AppDispatch } from "../../app/store";
import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { processLine } from "../../common/utils";
import { addImages } from "../project/projectSlice";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";

interface ImportSite {
  name: string;
  url: string;
}

export function AddCardsByURL() {
  const dispatch = useDispatch<AppDispatch>();

  const [showURLModal, setShowURLModal] = useState(false);
  const [loading, setLoading] = useState(false);
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
    setLoading(true); // TODO: hande]le errors in API response
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
    setLoading(false);
  };

  return (
    <>
      <Dropdown.Item onClick={handleShowURLModal}>
        <i className="bi bi-link-45deg" style={{ paddingRight: 0.5 + "em" }} />{" "}
        URL
      </Dropdown.Item>
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
          {importSites != null ? (
            <ul>
              {importSites.map((importSite: ImportSite) => (
                <li>
                  <a href={importSite.url} target="_blank">
                    {importSite.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
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
          )}
          <Form.Group className="mb-3">
            <Form.Control
              type={"url"}
              required={true}
              placeholder="https://"
              onChange={(event) => setURLModalValue(event.target.value)}
              value={URLModalValue}
              disabled={loading || importSites == null}
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
            disabled={loading || importSites == null}
          >
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
