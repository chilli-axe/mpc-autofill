/**
 * A table of Contributors (retrieved from backend) which facilitates controlling the order the Contributors are
 * searched in and whether each Contributor is active.
 * This component forms part of the Search Settings modal.
 */

import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import styled from "@emotion/styled";
import Link from "next/link";
import React, { ReactNode, useCallback, useMemo } from "react";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import {
  SourceDocument,
  SourceRow as SourceRowType,
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

interface SourceRowProps {
  sourceDocument: SourceDocument;
  enabled: boolean;
  index: number;
  enableReorderingSources: boolean;
  toggleSpecificSourceActiveStatus: (sourceIndex: number) => void;
  moveSourceToStart: (sourceIndex: number) => void;
  moveSourceToEnd: (sourceIndex: number) => void;
}

const SourceRow = ({
  sourceDocument,
  enabled,
  index,
  enableReorderingSources,
  toggleSpecificSourceActiveStatus,
  moveSourceToStart,
  moveSourceToEnd,
}: SourceRowProps) => {
  const { ref, isDragging } = useSortable({
    id: `source-${sourceDocument.pk}`,
    index: index,
  });
  return (
    <tr ref={ref}>
      <td style={{ verticalAlign: "middle", width: 30 + "%" }}>
        <Toggle
          on="On"
          onClassName="flex-centre prevent-select"
          off="Off"
          offClassName="flex-centre prevent-select"
          onstyle="primary"
          offstyle="secondary"
          size="md"
          width={80 + "%"}
          height={ToggleButtonHeight + "px"}
          active={enabled}
          onClick={() => toggleSpecificSourceActiveStatus(index)}
        />
      </td>
      <td style={{ verticalAlign: "middle", width: 50 + "%" }}>
        {(sourceDocument.externalLink ?? "").length > 0 ? (
          <Link href={sourceDocument.externalLink ?? ""} target="_blank">
            {sourceDocument.name}
          </Link>
        ) : (
          sourceDocument.name
        )}
      </td>
      <td
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
                className="bi bi-chevron-double-up"
                onClick={() => moveSourceToStart(index)}
              />
            </div>
            <div>
              <Chevron
                className="bi bi-chevron-double-down"
                onClick={() => moveSourceToEnd(index)}
              />
            </div>
          </>
        )}
      </td>
      <td
        style={{
          verticalAlign: "middle",
          width: 15 + "%",
          textAlign: "center",
        }}
      >
        {enableReorderingSources && (
          <i className="bi bi-grip-horizontal" style={{ fontSize: 2 + "em" }} />
        )}
      </td>
    </tr>
  );
};

interface SourceSettingsProps {
  sourceSettings: SourceSettingsType;
  setSourceSettings: {
    (newSourceSettings: SourceSettingsType): void;
  };
  enableReorderingSources?: boolean;
  showBoilerplate?: boolean;
}

export function SourceSettings({
  sourceSettings,
  setSourceSettings,
  enableReorderingSources = true,
  showBoilerplate = true,
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

  const moveSourceToStart = useCallback(
    (sourceIndex: number) => {
      moveSourceToIndex(sourceIndex, 0);
    },
    [moveSourceToIndex]
  );

  const moveSourceToEnd = useCallback(
    (sourceIndex: number) => {
      moveSourceToIndex(sourceIndex, (sourceSettings.sources ?? []).length - 1);
    },
    [moveSourceToIndex, sourceSettings]
  );

  /**
   * Update `localSourceOrder` according to the drag and drop result.
   */
  const onDragEnd = (event: any) => {
    const { source } = event.operation;
    if (isSortable(source) && source.initialIndex !== source.index) {
      moveSourceToIndex(source.initialIndex, source.index);
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
      const updatedSources: Array<SourceRowType> = sourceRows.map((x) => [
        x[0],
        !anySourcesActive,
      ]);
      setSourceSettings({ sources: updatedSources });
    }
  }, [sourceRows, setSourceSettings, anySourcesActive]);

  let sourceTable = <Spinner />;
  if (maybeSourceDocuments != null) {
    sourceTable = (
      <DragDropProvider onDragEnd={onDragEnd}>
        <Table variant="secondary" style={{ tableLayout: "auto" }}>
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
            {sourceRows.map(
              ([pk, enabled], index) =>
                maybeSourceDocuments[pk] !== undefined && (
                  <SourceRow
                    key={`source-${pk}`}
                    sourceDocument={maybeSourceDocuments[pk]}
                    enabled={enabled}
                    index={index}
                    enableReorderingSources={enableReorderingSources}
                    toggleSpecificSourceActiveStatus={
                      toggleSpecificSourceActiveStatus
                    }
                    moveSourceToStart={moveSourceToStart}
                    moveSourceToEnd={moveSourceToEnd}
                  />
                )
            )}
          </tbody>
        </Table>
      </DragDropProvider>
    );
  }

  return (
    <Container className="px-1">
      {showBoilerplate && (
        <>
          <h5>Contributors</h5>
          Configure the contributors to include in the search results.
          {enableReorderingSources && (
            <ul>
              <li>
                <b>Drag & drop</b> them to change the order they&apos;re
                searched in.
              </li>
              <li>
                Use the <b>arrows</b> to send a source to the top or bottom.
              </li>
            </ul>
          )}
        </>
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
