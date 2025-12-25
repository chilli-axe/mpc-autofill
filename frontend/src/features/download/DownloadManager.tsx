import styled from "@emotion/styled";
import React from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Offcanvas from "react-bootstrap/Offcanvas";
import Stack from "react-bootstrap/Stack";

import { NavbarLogoHeight } from "@/common/constants";
import { FileDownload, useAppSelector } from "@/common/types";
import { toTitleCase } from "@/common/utils";
import { RightPaddedIcon } from "@/components/icon";
import { Spinner } from "@/components/Spinner";
import { useTerminateQueuedDownloads } from "@/features/download/download";
import { selectSortedFileDownloads } from "@/store/slices/fileDownloadsSlice";

function DownloadIcon() {
  return <i className="bi bi-cloud-arrow-down text-white" />;
}

const DownloadStatusIcon = styled.i`
  font-size: 1.5em;
`;

const DownloadDropdownToggle = styled(Button)`
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
  width: ${NavbarLogoHeight}px;
  height: ${NavbarLogoHeight}px;
  position: relative;
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
  const downloadTypeIcon = (
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
  const downloadStatusIcon =
    status === undefined ? (
      <Spinner size={1.5} />
    ) : (
      <DownloadStatusIcon
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
    <Card className="my-1">
      <Card.Body className="p-1">
        <FixedHeightStack direction="horizontal" gap={0}>
          <div className="px-2 py-0">
            <Card.Title as="p" className="mb-0">
              {downloadTypeIcon}
              {name}
            </Card.Title>
            <Card.Subtitle as="p" className="text-muted">
              {downloadState}
              {formattedTimestamp && " — " + formattedTimestamp}
            </Card.Subtitle>
          </div>
          <div className="px-2 py-0 ms-auto">{downloadStatusIcon}</div>
        </FixedHeightStack>
      </Card.Body>
    </Card>
  );
}

export function TerminateQueuedDownloads() {
  const terminateQueuedDownloads = useTerminateQueuedDownloads();
  return (
    <div className="d-grid gap-0">
      <Button variant="danger" onClick={terminateQueuedDownloads}>
        Terminate Queued Downloads
      </Button>
    </div>
  );
}

interface OpenDownloadManagerButtonProps {
  handleClick: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function OpenDownloadManagerButton({
  handleClick,
}: OpenDownloadManagerButtonProps) {
  const fileDownloads = useAppSelector(selectSortedFileDownloads);
  const enqueuedCount = fileDownloads.filter(
    (item) => item.fileDownload.startedTimestamp === undefined
  ).length;
  const activeCount = fileDownloads.filter(
    (item) =>
      item.fileDownload.completedTimestamp === undefined &&
      item.fileDownload.startedTimestamp !== undefined
  ).length;

  return (
    <DownloadDropdownToggle
      onClick={handleClick}
      id="dropdown-basic"
      className="m-0 p-0"
    >
      <DownloadIcon />
      <span
        className={`position-absolute top-0 start-100 translate-middle-x badge rounded-pill text-bg-${
          enqueuedCount + activeCount > 0 ? "success" : "secondary"
        }`}
      >
        {enqueuedCount + activeCount}{" "}
        <span className="visually-hidden">downloads</span>
      </span>
    </DownloadDropdownToggle>
  );
}

interface DownloadManagerProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function DownloadManager({ show, handleClose }: DownloadManagerProps) {
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
    <Offcanvas
      show={show}
      onHide={handleClose}
      data-testid="download-manager-offcanvas"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>File Downloads</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <p>
          <b>{enqueuedCount}</b> enqueued, <b>{activeCount}</b> active, and{" "}
          <b>{completedCount}</b> completed.
        </p>
        {enqueuedCount > 0 && <TerminateQueuedDownloads />}
        {fileDownloads.length > 0 && <hr />}
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
      </Offcanvas.Body>
    </Offcanvas>
  );
}
