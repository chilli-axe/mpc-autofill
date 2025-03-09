import React from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Dropdown from "react-bootstrap/Dropdown";
import Stack from "react-bootstrap/Stack";
import styled from "styled-components";

import { FileDownload, useAppSelector } from "@/common/types";
import { toTitleCase } from "@/common/utils";
import { RightPaddedIcon } from "@/components/icon";
import { Spinner } from "@/components/Spinner";
import { useTerminateQueuedDownloads } from "@/features/download/download";
import { selectSortedFileDownloads } from "@/store/slices/fileDownloadsSlice";

function DownloadIcon() {
  return <i className="bi bi-cloud-arrow-down text-white" />;
}

const FontSizeTwoI = styled.i`
  font-size: 2em;
`;

const DownloadDropdownToggle = styled(Dropdown.Toggle)`
  border: 0;
  background-color: transparent;
  :hover {
    background-color: transparent;
  }
  ::after {
    content: unset;
  }
  &:hover {
    background-color: rgba(255, 255, 255, 20%);
  }
  &:focus {
    background-color: rgba(255, 255, 255, 20%);
    box-shadow: unset;
  }
  --bs-btn-active-bg: rgba(255, 255, 255, 15%);
  --bs-btn-active-color: rgba(255, 255, 255, 15%);

  border-radius: 4px;
  transition: background-color 0.1s ease-in-out;
  cursor: pointer;
`;

const MinWidthDropdownMenu = styled(Dropdown.Menu)`
  min-width: 30em;
  max-height: 30em;
  overflow-y: scroll;
`;

const FixedHeightStack = styled(Stack)`
  height: 3.5em;
`;

export function FileDownloadEntry({
  name,
  type,
  enqueuedTimestamp,
  startedTimestamp,
  completedTimestamp,
  status,
}: FileDownload) {
  const formattedTimestamp = completedTimestamp
    ? new Date(completedTimestamp).toLocaleString()
    : null;
  const downloadState =
    status === undefined ? "Downloading..." : toTitleCase(status);
  const leftHandSideIcon = (
    <RightPaddedIcon
      bootstrapIconName={
        {
          image: "image",
          xml: "file-code",
          text: "card-text",
        }[type]
      }
    />
  );
  const rightHandSideIcon =
    status === undefined ? (
      <Spinner size={2} />
    ) : (
      <FontSizeTwoI
        className={
          "bi bi-" +
          {
            failed: "x-circle",
            success: "check-circle",
            terminated: "dash-circle",
          }[status]
        }
      />
    );
  return (
    <Dropdown.Item>
      <Card>
        <Card.Body className="p-1">
          <FixedHeightStack direction="horizontal" gap={0}>
            <div className="px-2 py-0">
              <Card.Title as="p" className="mb-0">
                {leftHandSideIcon}
                {name}
              </Card.Title>
              <Card.Subtitle as="p" className="text-muted">
                {downloadState}
                {formattedTimestamp && " — " + formattedTimestamp}
              </Card.Subtitle>
            </div>
            <div className="px-2 py-0 ms-auto">{rightHandSideIcon}</div>
          </FixedHeightStack>
        </Card.Body>
      </Card>
    </Dropdown.Item>
  );
}

export function TerminateQueuedDownloads() {
  const terminateQueuedDownloads = useTerminateQueuedDownloads();
  return (
    <div className="d-grid gap-0 mx-3 mt-2">
      <Button variant="danger" onClick={terminateQueuedDownloads}>
        Terminate Queued Downloads
      </Button>
    </div>
  );
}

export function DownloadManager() {
  const fileDownloads = useAppSelector(selectSortedFileDownloads);
  const enqueuedCount = fileDownloads.filter(
    (item) => item.fileDownload.startedTimestamp === undefined
  ).length;
  const activeCount = fileDownloads.filter(
    (item) =>
      item.fileDownload.completedTimestamp === undefined &&
      item.fileDownload.startedTimestamp !== undefined
  ).length;
  const completedCount = fileDownloads.length - enqueuedCount - activeCount;

  return (
    <Dropdown autoClose="outside">
      <DownloadDropdownToggle
        id="dropdown-basic"
        className="m-0"
        style={{ width: 40 + "px", height: 40 + "px" }}
      >
        <DownloadIcon />

        {enqueuedCount + activeCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle-x badge rounded-pill text-bg-secondary">
            {enqueuedCount + activeCount}{" "}
            <span className="visually-hidden">downloads</span>
          </span>
        )}
      </DownloadDropdownToggle>
      <MinWidthDropdownMenu align="end">
        <Dropdown.Header>File Downloads</Dropdown.Header>
        <Dropdown.Item href="">
          <b>{enqueuedCount}</b> enqueued, <b>{activeCount}</b> active, and{" "}
          <b>{completedCount}</b> completed.
        </Dropdown.Item>
        {enqueuedCount > 0 && <TerminateQueuedDownloads />}
        {fileDownloads.length > 0 && <Dropdown.Divider />}
        {fileDownloads.map(({ id, fileDownload }) => (
          <FileDownloadEntry
            key={id}
            name={fileDownload.name}
            type={fileDownload.type}
            enqueuedTimestamp={fileDownload.enqueuedTimestamp}
            startedTimestamp={fileDownload.startedTimestamp}
            completedTimestamp={fileDownload.completedTimestamp}
            status={fileDownload.status}
          />
        ))}
      </MinWidthDropdownMenu>
    </Dropdown>
  );
}
