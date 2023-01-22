import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import React, { useState, useEffect, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../app/store";
import { setFuzzySearch, setCardSources } from "./searchSettingsSlice";
import Table from "react-bootstrap/Table";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { getSearchSettings, setSearchSettings } from "../../common/cookies";

// @ts-ignore  // TODO: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

type SourceRow = [string, boolean];

export function SearchSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const [show, setShow] = useState(false);

  // component-level copies of redux state
  const fuzzySearch = useSelector(
    (state: RootState) => state.searchSettings.fuzzySearch
  );
  const [localFuzzySearch, setLocalFuzzySearch] = useState(fuzzySearch);

  const initialLocalSourceOrder: Array<SourceRow> = [];
  const [localSourceOrder, setLocalSourceOrder] = useState(
    initialLocalSourceOrder
  );

  const maybeSourceDocuments = useSelector(
    (state: RootState) => state.sourceDocuments.sourceDocuments
  );
  useEffect(
    // TODO: this needs to move such that the initial redux state is set from this selector, not react state
    () => {
      const cookieSettings = getSearchSettings();

      const unmatchedSources: Array<string> = Object.keys(
        maybeSourceDocuments ?? {}
      );

      if (cookieSettings != null) {
        // alert("cookieSettings not null")
        // dispatch(setFuzzySearch(cookieSettings.fuzzySearch));
        //
        // for (const man of cookieSettings.drives) {
        //   alert(JSON.stringify(man))
        // }

        // TODO: temporary
        setLocalSourceOrder(unmatchedSources.map((x) => [x, true]));
      } else {
        setLocalSourceOrder(unmatchedSources.map((x) => [x, true]));
      }

      /**
       * create a new object to track whether each drive is enabled or disabled. initialise as empty list. called `x`
       * for each item in cookie drives:
       * check if the item matches a drive fetched from the database
       * if it does, append to `x` the drive name and whether it's enabled or not, and remove the drive from the list
       * of sources retrieved from the database
       * once you reach the end of this loop, iterate over the remaining sources retrieved from the database,
       * and set them all to true.
       */
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

    // TODO
    setSearchSettings({
      fuzzySearch: localFuzzySearch,
      drives: localSourceOrder,
    });
    dispatch(setFuzzySearch(localFuzzySearch));
    dispatch(
      setCardSources(localSourceOrder.filter((x) => x[1]).map((x) => x[0]))
    );

    handleClose();
  };

  const onDragEnd = (result: any) => {
    // TODO: get rid of this any type
    // TODO: review this bit of code (copied from drag/drop sandbox example) and see if it can be improved
    const updatedSourceOrder = [...localSourceOrder];
    const [removed] = updatedSourceOrder.splice(result.source.index, 1);
    updatedSourceOrder.splice(result.destination.index, 0, removed);
    setLocalSourceOrder(updatedSourceOrder);
  };

  const toggleSpecificSourceEnabledStatus = (index: number) => {
    let updatedSourceOrder = [...localSourceOrder];
    updatedSourceOrder[index][1] = !updatedSourceOrder[index][1];
    setLocalSourceOrder(updatedSourceOrder);
  };

  const toggleAllSourceEnabledStatuses = () => {
    const newEnabledStatus: boolean = !localSourceOrder.some((x) => x[1]);
    let updatedSourceOrder: Array<SourceRow> = localSourceOrder.map((x) => [
      x[0],
      newEnabledStatus,
    ]);
    setLocalSourceOrder(updatedSourceOrder);
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
    const sourceRows: Array<ReactNode> = localSourceOrder.map(
      (sourceRow, index) => (
        <Draggable key={sourceRow[0]} draggableId={sourceRow[0]} index={index}>
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
                  active={sourceRow[1]}
                  onClick={() => toggleSpecificSourceEnabledStatus(index)}
                />
              </td>
              <td style={{ verticalAlign: "middle", width: 40 + "%" }}>
                {maybeSourceDocuments[sourceRow[0]].external_link != null ? (
                  <a
                    href={maybeSourceDocuments[sourceRow[0]].external_link}
                    target="_blank"
                  >
                    {maybeSourceDocuments[sourceRow[0]].name}
                  </a>
                ) : (
                  <a>{maybeSourceDocuments[sourceRow[0]].name}</a>
                )}
              </td>
              <td
                className="prevent-select"
                style={{ verticalAlign: "middle", width: 30 + "%" }}
              >
                {maybeSourceDocuments[sourceRow[0]].source_type}
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
      )
    );
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
