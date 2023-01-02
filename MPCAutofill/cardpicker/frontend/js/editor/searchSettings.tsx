import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import React, { useState, useEffect, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "./store";
import { setFuzzySearch } from "./searchSettingsSlice";
import Table from "react-bootstrap/Table";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// @ts-ignore  // TODO: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

interface SourceEnabledStatus {
  [source: string]: boolean;
}

export function SearchSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const [show, setShow] = useState(false);

  // component-level copies of redux state
  const fuzzySearch = useSelector(
    (state: RootState) => state.searchSettings.fuzzySearch
  );
  const [localFuzzySearch, setLocalFuzzySearch] = useState(fuzzySearch);

  const [sourceOrder, setSourceOrder] = useState([]);

  const initialSourceEnabledStatusState: SourceEnabledStatus = {};
  const [sourceEnabledStatus, setSourceEnabledStatus] = useState(
    initialSourceEnabledStatusState
  );

  const maybeSourceDocuments = useSelector(
    (state: RootState) => state.sourceDocuments.sourceDocuments
  );
  useEffect(
    // TODO: this needs to move such that the initial redux state is set from this selector, not react state
    () => {
      const sourceArray: Array<string> = Object.keys(
        maybeSourceDocuments ?? {}
      );
      setSourceOrder(sourceArray);
      setSourceEnabledStatus(
        Object.assign({}, ...sourceArray.map((x: string) => ({ [x]: true })))
      );
    },
    [maybeSourceDocuments]
  );

  // modal management functions
  const handleClose = () => setShow(false);
  const handleShow = () => {
    // set up the component-level state with the current redux state
    setLocalFuzzySearch(fuzzySearch);
    setShow(true);
  };
  const handleSave = () => {
    // copy component-level state into redux state when the user clicks "save changes"
    dispatch(setFuzzySearch(localFuzzySearch));
    // TODO: set which sources are enabled in redux
    handleClose();
  };

  const onDragEnd = (result: any) => {
    // TODO: get rid of this any type
    // TODO: review this bit of code (copied from drag/drop sandbox example) and see if it can be improved
    const reorderedSourceOrder = [...sourceOrder];
    const [removed] = reorderedSourceOrder.splice(result.source.index, 1);
    reorderedSourceOrder.splice(result.destination.index, 0, removed);
    setSourceOrder(reorderedSourceOrder);
  };

  const toggleSpecificSourceEnabledStatus = (source: string) => {
    const sourceEnabledStatusCopy: SourceEnabledStatus = {
      ...sourceEnabledStatus,
    };
    sourceEnabledStatusCopy[source] = !sourceEnabledStatusCopy[source];
    setSourceEnabledStatus(sourceEnabledStatusCopy);
  };

  const toggleAllSourceEnabledStatuses = () => {
    const newEnabledStatus = !Object.values(sourceEnabledStatus).some(
      (x) => x === true
    );
    const sourceEnabledStatusCopy: SourceEnabledStatus = Object.assign(
      {},
      ...Object.keys(sourceEnabledStatus).map((x: string) => ({
        [x]: newEnabledStatus,
      }))
    );
    setSourceEnabledStatus(sourceEnabledStatusCopy);
  };

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
    const sourceRows: Array<ReactNode> = sourceOrder.map((sourceKey, index) => (
      <Draggable key={sourceKey} draggableId={sourceKey} index={index}>
        {(provided, snapshot) => (
          <tr
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
          >
            <td style={{ verticalAlign: "middle", width: 20 + "%" }}>
              <Toggle
                on="On"
                onClassName="flex-centre prevent-select"
                off="Off"
                offClassName="flex-centre prevent-select"
                onstyle="primary"
                offstyle="secondary"
                size="md"
                height={38 + "px"}
                active={
                  sourceEnabledStatus[maybeSourceDocuments[sourceKey].key]
                }
                onClick={() =>
                  toggleSpecificSourceEnabledStatus(
                    maybeSourceDocuments[sourceKey].key
                  )
                }
              />
            </td>
            <td style={{ verticalAlign: "middle", width: 40 + "%" }}>
              {maybeSourceDocuments[sourceKey].external_link != null ? (
                <a
                  href={maybeSourceDocuments[sourceKey].external_link}
                  target="_blank"
                >
                  {maybeSourceDocuments[sourceKey].name}
                </a>
              ) : (
                <a>{maybeSourceDocuments[sourceKey].name}</a>
              )}
            </td>
            <td
              className="prevent-select"
              style={{ verticalAlign: "middle", width: 30 + "%" }}
            >
              {maybeSourceDocuments[sourceKey].source_type}
            </td>
            <td
              style={{
                verticalAlign: "middle",
                width: 10 + "%",
                textAlign: "center",
              }}
            >
              <i
                className="bi bi-grip-horizontal"
                style={{ fontSize: 2 + "em" }}
              />
            </td>
          </tr>
        )}
      </Draggable>
    ));
    sourceTable = (
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="source-order">
          {(provided, snapshot) => (
            <div style={{ height: sourceRows.length * 59 + 38 + "px" }}>
              <Table ref={provided.innerRef} style={{ tableLayout: "auto" }}>
                <thead>
                  <tr
                    style={{ height: 38 + "px" }}
                    onClick={toggleAllSourceEnabledStatuses}
                  >
                    <th className="prevent-select">Enabled</th>
                    <th className="prevent-select">Source Name</th>
                    <th className="prevent-select">Source Type</th>
                    <th />
                  </tr>
                </thead>
                <tbody>{sourceRows}</tbody>
              </Table>
            </div>
          )}
        </Droppable>
      </DragDropContext>
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
            Close Without Saving
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
