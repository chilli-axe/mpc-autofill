/**
 * A table of Card Sources (retrieved from backend) which facilitates controlling the order the Sources are
 * searched in and whether each Source is enabled.
 * This component forms part of the Search Settings modal.
 */

import React, { ReactNode } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd"; // TODO: look into using `react-dnd` instead as it's a significantly smaller package
import Table from "react-bootstrap/Table";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";
import {
  SourceRow,
  SourceSettings as SourceSettingsType,
} from "../../common/types";
import { ToggleButtonHeight } from "@/common/constants";

// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

// TODO: make min/max DPI sliders stack vertically on mobile

interface SourceSettingsProps {
  sourceSettings: SourceSettingsType;
  setSourceSettings: {
    (newSourceSettings: SourceSettingsType): void;
  };
}

export function SourceSettings(props: SourceSettingsProps) {
  const maybeSourceDocuments = useSelector(
    (state: RootState) => state.sourceDocuments.sourceDocuments
  );

  const moveSourceToIndex = (sourceIndex: number, destinationIndex: number) => {
    const updatedSources = [...(props.sourceSettings.sources ?? [])];
    const [removed] = updatedSources.splice(sourceIndex, 1);
    updatedSources.splice(destinationIndex, 0, removed);
    props.setSourceSettings({ sources: updatedSources });
  };

  const onDragEnd = (result: DropResult) => {
    /**
     * Update `localSourceOrder` according to the drag and drop result.
     */

    if (result.destination != null) {
      moveSourceToIndex(result.source.index, result.destination.index);
    }
  };

  const toggleSpecificSourceEnabledStatus = (index: number) => {
    /**
     * Toggle the enabled status of the source at `index` in `localSourceOrder`.
     */

    const updatedSources = [...(props.sourceSettings.sources ?? [])];
    updatedSources[index] = [
      updatedSources[index][0],
      !updatedSources[index][1],
    ];
    props.setSourceSettings({ sources: updatedSources });
  };

  const toggleAllSourceEnabledStatuses = () => {
    /**
     * Toggle the enabled status of all sources in `localSourceOrder`. If any is enabled, they're all disabled.
     */

    const sourcesOrEmpty = props.sourceSettings.sources ?? [];
    const newEnabledStatus = !sourcesOrEmpty.some((x) => x[1]);
    const updatedSources: Array<SourceRow> = sourcesOrEmpty.map((x) => [
      x[0],
      newEnabledStatus,
    ]);
    props.setSourceSettings({ sources: updatedSources });
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
    const sourceRows: Array<ReactNode> = (
      props.sourceSettings.sources ?? []
    ).map((sourceRow, index) => (
      <Draggable
        key={sourceRow[0]}
        draggableId={sourceRow[0].toString()}
        index={index}
      >
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
                height={ToggleButtonHeight + "px"}
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
                width: 5 + "%",
                textAlign: "center",
              }}
            >
              <div>
                <i
                  className="bi bi-chevron-double-up"
                  style={{ fontSize: 1 + "em", cursor: "pointer" }}
                  onClick={() => {
                    moveSourceToIndex(index, 0);
                  }}
                />
              </div>
              <div>
                <i
                  className="bi bi-chevron-double-down"
                  style={{ fontSize: 1 + "em", cursor: "pointer" }}
                  onClick={() => {
                    moveSourceToIndex(
                      index,
                      (props.sourceSettings.sources ?? []).length - 1
                    );
                  }}
                />
              </div>
            </td>
            <td
              style={{
                verticalAlign: "middle",
                width: 5 + "%",
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
            <div
              style={{
                height: sourceRows.length * 59 + ToggleButtonHeight + "px",
              }}
            >
              <Table ref={provided.innerRef} style={{ tableLayout: "auto" }}>
                <thead>
                  <tr
                    style={{ height: ToggleButtonHeight + "px" }}
                    onClick={toggleAllSourceEnabledStatuses}
                  >
                    <th className="prevent-select">Enabled</th>
                    <th className="prevent-select">Source Name</th>
                    <th className="prevent-select">Source Type</th>
                    <th />
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
    <>
      <h5>Sources</h5>
      Configure the sources you&apos;d like to search. <b>Drag & drop</b> them
      to change the order they&apos;re searched in.
      <br />
      Use the <b>arrows</b> to send a source to the top or bottom.
      <br />
      Click the <b>table header</b> to enable or disable all sources.
      <br />
      <br />
      {sourceTable}
    </>
  );
}
