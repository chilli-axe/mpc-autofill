/**
 * A table of Contributors (retrieved from backend) which facilitates controlling the order the Contributors are
 * searched in and whether each Contributor is active.
 * This component forms part of the Search Settings modal.
 */

import styled from "@emotion/styled";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd"; // TODO: look into using `react-dnd` instead as it's a significantly smaller package
import Link from "next/link";
import React, { ReactNode, useCallback, useMemo } from "react";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import {
  SourceRow,
  SourceSettings as SourceSettingsType,
  useAppSelector,
} from "@/common/types";
import { getSourceRowsFromSourceSettings } from "@/common/utils";
import { Spinner } from "@/components/Spinner";
import { selectSourceDocuments } from "@/store/slices/sourceDocumentsSlice";

const Chevron = styled.i`
  font-size: 1em;
  cursor: pointer;
`;

interface SourceSettingsProps {
  sourceSettings: SourceSettingsType;
  setSourceSettings: {
    (newSourceSettings: SourceSettingsType): void;
  };
  enableReorderingSources?: boolean;
}

export function SourceSettings({
  sourceSettings,
  setSourceSettings,
  enableReorderingSources = true,
}: SourceSettingsProps) {
  const sourceRows = useMemo(
    () => getSourceRowsFromSourceSettings(sourceSettings),
    [sourceSettings]
  );

  const maybeSourceDocuments = useAppSelector(selectSourceDocuments);
  const anySourcesActive = (sourceSettings.sources ?? []).some((x) => x[1]);

  const moveSourceToIndex = useCallback(
    (sourceIndex: number, destinationIndex: number) => {
      const updatedSources = [...(sourceSettings.sources ?? [])];
      const [removed] = updatedSources.splice(sourceIndex, 1);
      updatedSources.splice(destinationIndex, 0, removed);
      setSourceSettings({ sources: updatedSources });
    },
    [sourceSettings.sources, setSourceSettings]
  );

  /**
   * Update `localSourceOrder` according to the drag and drop result.
   */
  const onDragEnd = (result: DropResult) => {
    if (result.destination != null) {
      moveSourceToIndex(result.source.index, result.destination.index);
    }
  };

  /**
   * Toggle the active status of the source at `index` in `localSourceOrder`.
   */
  const toggleSpecificSourceActiveStatus = useCallback(
    (index: number) => {
      const updatedSources = [...(sourceSettings.sources ?? [])];
      updatedSources[index] = [
        updatedSources[index][0],
        !updatedSources[index][1],
      ];
      setSourceSettings({ sources: updatedSources });
    },
    [sourceSettings.sources, setSourceSettings]
  );

  /**
   * Toggle the active status of all sources in `localSourceOrder`. If any is active, they're all inactive.
   */
  const toggleAllSourceActiveness = useCallback(() => {
    if (sourceRows.length > 0) {
      const updatedSources: Array<SourceRow> = sourceRows.map((x) => [
        x[0],
        !anySourcesActive,
      ]);
      setSourceSettings({ sources: updatedSources });
    }
  }, [sourceRows, setSourceSettings, anySourcesActive]);

  let sourceTable = <Spinner />;
  if (maybeSourceDocuments != null) {
    const draggableSourceRows: Array<ReactNode> = sourceRows.map(
      (sourceRow, index) => (
        <Draggable
          key={sourceRow[0]}
          draggableId={sourceRow[0].toString()}
          index={index}
          isDragDisabled={!enableReorderingSources}
        >
          {(provided, snapshot) => (
            <tr
              key={`${sourceRow[0]}-row`}
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
            >
              <td
                key={`${sourceRow[0]}-toggle-column`}
                style={{ verticalAlign: "middle", width: 30 + "%" }}
              >
                <Toggle
                  key={`${sourceRow[0]}-toggle`}
                  on="On"
                  onClassName="flex-centre prevent-select"
                  off="Off"
                  offClassName="flex-centre prevent-select"
                  onstyle="primary"
                  offstyle="secondary"
                  size="md"
                  width={80 + "%"}
                  height={ToggleButtonHeight + "px"}
                  active={sourceRow[1]}
                  onClick={() => toggleSpecificSourceActiveStatus(index)}
                />
              </td>
              <td
                key={`${sourceRow[0]}-name-column`}
                style={{ verticalAlign: "middle", width: 50 + "%" }}
              >
                {(maybeSourceDocuments[sourceRow[0]].externalLink ?? "")
                  .length > 0 ? (
                  <Link
                    href={maybeSourceDocuments[sourceRow[0]].externalLink ?? ""}
                    target="_blank"
                  >
                    {maybeSourceDocuments[sourceRow[0]].name}
                  </Link>
                ) : (
                  maybeSourceDocuments[sourceRow[0]].name
                )}
              </td>
              <td
                key={`${sourceRow[0]}-updown-button-column`}
                style={{
                  verticalAlign: "middle",
                  width: 5 + "%",
                  textAlign: "center",
                }}
              >
                {enableReorderingSources && (
                  <>
                    <div>
                      <Chevron
                        key={`${sourceRow[0]}-up-button`}
                        className="bi bi-chevron-double-up"
                        onClick={() => {
                          moveSourceToIndex(index, 0);
                        }}
                      />
                    </div>
                    <div>
                      <Chevron
                        key={`${sourceRow[0]}-down-button`}
                        className="bi bi-chevron-double-down"
                        onClick={() => {
                          moveSourceToIndex(
                            index,
                            (sourceSettings.sources ?? []).length - 1
                          );
                        }}
                      />
                    </div>
                  </>
                )}
              </td>
              <td
                key={`${sourceRow[0]}-drag-button-column`}
                style={{
                  verticalAlign: "middle",
                  width: 15 + "%",
                  textAlign: "center",
                }}
              >
                {enableReorderingSources && (
                  <i
                    key={`${sourceRow[0]}-drag-button`}
                    className="bi bi-grip-horizontal"
                    style={{ fontSize: 2 + "em" }}
                  />
                )}
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
            <Table
              variant="secondary"
              ref={provided.innerRef}
              style={{ tableLayout: "auto" }}
            >
              {/* TODO: migrate this to AutofillTable at some point? too big a job for right now. */}
              <thead>
                <tr style={{ height: ToggleButtonHeight + "px" }}>
                  <th className="prevent-select">Active</th>
                  <th className="prevent-select">Name</th>
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {draggableSourceRows}
                {provided.placeholder}
              </tbody>
            </Table>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  return (
    <Container className="px-1">
      <h5>Contributors</h5>
      Configure the contributors to include in the search results.
      {enableReorderingSources && (
        <ul>
          <li>
            <b>Drag & drop</b> them to change the order they&apos;re searched
            in.
          </li>
          <li>
            Use the <b>arrows</b> to send a source to the top or bottom.
          </li>
        </ul>
      )}
      <div className="d-grid gap-0 mt-3">
        <Button variant="primary" onClick={toggleAllSourceActiveness}>
          {anySourcesActive ? "Disable" : "Enable"} all drives
        </Button>
      </div>
      <br />
      {sourceTable}
    </Container>
  );
}
