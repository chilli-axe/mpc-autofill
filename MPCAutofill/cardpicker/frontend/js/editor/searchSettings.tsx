import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import React, { useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "./store";
import { setFuzzySearch } from "./searchSettingsSlice";
import Table from "react-bootstrap/Table";

// @ts-ignore  // TODO: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

export function SearchSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const [show, setShow] = useState(false);

  const fuzzySearch = useSelector(
    (state: RootState) => state.searchSettings.fuzzySearch
  );
  const [localFuzzySearch, setLocalFuzzySearch] = useState(fuzzySearch);

  const handleClose = () => setShow(false);
  const handleShow = () => {
    setLocalFuzzySearch(fuzzySearch);
    setShow(true);
  };
  const handleSave = () => {
    dispatch(setFuzzySearch(localFuzzySearch));
    handleClose();
  };

  const maybeSourceDocuments = useSelector(
    (state: RootState) => state.sourceDocuments.sourceDocuments
  );

  const onDragEnd = useCallback(() => {
    // the only one that is required
  }, []);

  let sourceTable = (
    <div className="d-flex justify-content-center align-items-center">
      <div
        className="spinner-border"
        style={{ width: 4 + "em", height: 4 + "em" }}
        role="status"
      >
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
  if (maybeSourceDocuments != null) {
    // TODO: logic for ordering of sources in the table goes here
    let sourceRows = [];
    for (const [sourceKey, sourceDocument] of Object.entries(
      maybeSourceDocuments
    )) {
      sourceRows.push(
        <tr>
          <td style={{ verticalAlign: "middle" }}>
            <Toggle
              on="On"
              onClassName="flex-centre prevent-select"
              off="Off"
              offClassName="flex-centre prevent-select"
              onstyle="primary"
              offstyle="primary"
              size="md"
              height={38 + "px"}
            />
          </td>
          <td style={{ verticalAlign: "middle" }}>
            {sourceDocument.external_link != null ? (
              <a
                className="prevent-select"
                href={sourceDocument.external_link}
                target="_blank"
              >
                {sourceDocument.name}
              </a>
            ) : (
              <a className="prevent-select">{sourceDocument.name}</a>
            )}
          </td>
          <td style={{ verticalAlign: "middle" }}>
            <a className="prevent-select">{sourceDocument.source_type}</a>
          </td>
          <td style={{ verticalAlign: "middle" }}>
            <i
              className="bi bi-grip-horizontal"
              style={{ fontSize: 2 + "em" }}
            ></i>
          </td>
        </tr>
      );
    }
    sourceTable = (
      <Table>
        <thead>
          <tr>
            <th className="prevent-select">Enabled</th>
            <th className="prevent-select">Name</th>
            <th className="prevent-select">Source Type</th>
            <th />
          </tr>
        </thead>
        <tbody>{sourceRows}</tbody>
      </Table>
    );
  }
  return (
    <div className="d-grid gap-0">
      <Button variant="primary" onClick={handleShow}>
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
          <br />
          <Toggle
            onClick={() => setLocalFuzzySearch(!localFuzzySearch)}
            on="Fuzzy Search"
            onClassName="flex-centre"
            off="Precise Search"
            offClassName="flex-centre"
            onstyle="success"
            offstyle="info"
            width={100 + "%"}
            size="md"
            height={38 + "px"}
            active={localFuzzySearch}
          />
          <br />
          <br />
          {sourceTable}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
