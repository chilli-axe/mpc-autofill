import React, { useState } from "react";
import { Alert } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import ProgressBar from "react-bootstrap/ProgressBar";
import styled from "styled-components";

import { ProjectName } from "@/common/constants";
import { useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { Spinner } from "@/components/Spinner";
import {
  useDownloadContext,
  useQueueImageDownload,
} from "@/features/download/downloadImages";
import { useCardDocumentsByIdentifier } from "@/store/slices/cardDocumentsSlice";
import { selectIsProjectEmpty } from "@/store/slices/projectSlice";

const StyledProgressBar = styled(ProgressBar)`
  --bs-progress-bg: #424e5c;
`;

export function ExportImages() {
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  const queueImageDownload = useQueueImageDownload();
  const queue = useDownloadContext();

  const [showImagesModal, setShowImagesModal] = useState<boolean>(false);
  const handleCloseImagesModal = () => setShowImagesModal(false);
  const handleShowImagesModal = () => setShowImagesModal(true);

  const cardDocumentsByIdentifier = useCardDocumentsByIdentifier();
  const identifierCount = Object.keys(cardDocumentsByIdentifier).length;

  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloaded, setDownloaded] = useState<number>(0);
  const downloadInProgress =
    downloading && !(downloaded == identifierCount && downloaded > 0);
  const progress = (100 * downloaded) / identifierCount;

  const downloadImages = async () => {
    setDownloaded(0);
    Object.values(cardDocumentsByIdentifier).map((cardDocument) => {
      queueImageDownload(cardDocument).then(() => {
        setDownloaded((n) => n + 1);
      });
    });
  };

  return (
    <>
      <Dropdown.Item disabled={isProjectEmpty} onClick={handleShowImagesModal}>
        <RightPaddedIcon bootstrapIconName="image" /> Card Images
      </Dropdown.Item>
      <Modal
        scrollable
        show={showImagesModal}
        onHide={handleCloseImagesModal}
        data-testid="export-images"
      >
        <Modal.Header closeButton>
          <Modal.Title>Download — Card Images</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {downloading && (
            <p>
              Your images should be downloading now. This might take a while!
              Please don&apos;t close the page until the process is complete.
            </p>
          )}
          {!downloading && identifierCount == 0 && (
            <p>
              You&apos;ll be able to download the card images in your project
              here once you&apos;ve added some cards.
            </p>
          )}
          {!downloading && identifierCount > 0 && (
            <>
              <p>
                Click the button below to begin. This will download the{" "}
                <b>{identifierCount}</b> unique image
                {identifierCount != 1 && "s"} in your project.
              </p>
              <p>This feature may not work as expected on mobile devices.</p>
              <Alert variant="info">
                If you&apos;re planning on using the {ProjectName} desktop tool
                to auto-fill your project, you don&apos;t need to download
                images here. The desktop tool will download your images for you.
              </Alert>
            </>
          )}
          {downloading && (
            <>
              <StyledProgressBar
                striped
                animated={true}
                now={progress}
                label={`${downloaded} / ${identifierCount}`}
                variant="success"
              />
              <br />
            </>
          )}
          {downloadInProgress && (
            <>
              <div className="d-grid gap-0">
                <Button
                  variant="danger"
                  onClick={() => {
                    // clear the queue of waiting images
                    while (queue.queueWaiting.size() > 0) {
                      queue.queueWaiting.pop();
                    }
                    setDownloading(false);
                  }}
                >
                  Terminate Queued Downloads
                </Button>
              </div>
              <br />
            </>
          )}

          <div className="d-grid gap-0">
            <Button
              variant="primary"
              onClick={() => {
                setDownloading(true);
                downloadImages();
              }}
              disabled={downloadInProgress}
            >
              {downloadInProgress ? <Spinner size={1.5} /> : "Download Images"}
            </Button>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseImagesModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
