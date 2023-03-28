// TODO: make the modal unable to be dismissed while the URL is loading

import { useDispatch } from "react-redux";
import { AppDispatch } from "@/app/store";
import React, { useEffect, useState } from "react";
import { processLines } from "@/common/processing";
import { addImages } from "../project/projectSlice";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { APIGetImportSites, APIQueryImportSite } from "@/app/api";
import { ImportSite, DFCPairs } from "@/common/types";

interface ImportURLProps {
  dfcPairs: DFCPairs;
}

export function ImportURL(props: ImportURLProps) {
  const dispatch = useDispatch<AppDispatch>();

  // TODO: should probably set up type hints for all `useState` usages
  const [showURLModal, setShowURLModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleCloseURLModal = () => setShowURLModal(false);
  const handleShowURLModal = () => setShowURLModal(true);
  const [URLModalValue, setURLModalValue] = useState("");
  const [importSites, setImportSites] = useState<ImportSite[] | null>(null);

  useEffect(() => {
    APIGetImportSites().then((results) => setImportSites(results));
  }, []);

  const handleSubmitURLModal = async () => {
    // TODO: propagate the custom site name through to the new frontend
    const trimmedURL = URLModalValue.trim();
    if (trimmedURL.length > 0) {
      setLoading(true);
      const lines = await APIQueryImportSite(trimmedURL);
      const processedLines = processLines(lines, props.dfcPairs);
      dispatch(addImages({ lines: processedLines }));
      handleCloseURLModal();
      setLoading(false);
    }
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
                <li key={`${importSite.name}-row`}>
                  <a
                    key={importSite.name}
                    href={importSite.url}
                    target="_blank"
                  >
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
