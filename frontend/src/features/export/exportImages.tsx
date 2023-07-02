import { saveAs } from "file-saver";
import React, { useRef, useState } from "react";
import { Alert } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import ProgressBar from "react-bootstrap/ProgressBar";
import styled from "styled-components";
import { FunctionThread, Pool, spawn, Worker } from "threads";

import { ProjectName } from "@/common/constants";
import { base64StringToBlob } from "@/common/processing";
import { useAppSelector } from "@/common/types";
import { selectProjectMemberIdentifiers } from "@/features/project/projectSlice";
import { Spinner } from "@/features/ui/spinner";

const StyledProgressBar = styled(ProgressBar)`
  --bs-progress-bg: #424e5c;
`;

export function ExportImages() {
  const [showImagesModal, setShowImagesModal] = useState(false);
  const handleCloseImagesModal = () => setShowImagesModal(false);
  const handleShowImagesModal = () => setShowImagesModal(true);

  const [downloading, setDownloading] = useState<boolean>(false);

  const cardIdentifiers = Array.from(
    useAppSelector(selectProjectMemberIdentifiers)
  );
  const cardDocumentsByIdentifier = useAppSelector((state) =>
    Object.fromEntries(
      cardIdentifiers.map((identifier) => [
        identifier,
        state.cardDocuments.cardDocuments[identifier],
      ])
    )
  );

  const [downloaded, setDownloaded] = useState<number>(0);
  const progress = (100 * downloaded) / cardIdentifiers.length;

  const workerPool = useRef<Pool<FunctionThread> | null>(null);
  const terminate = async () => {
    if (workerPool.current != null) {
      await workerPool.current.terminate(true);
      setDownloading(false);
    }
  };

  const downloadImages = async () => {
    setDownloading(true);
    setDownloaded(0);

    // @ts-ignore: I don't know what the correct type of workerPool (set in useRef above) is
    workerPool.current = Pool(
      () =>
        // @ts-ignore: passing this a URL is correct. passing it a string breaks it.
        spawn(new Worker(new URL("./workers/download.ts", import.meta.url))),
      5
    );

    // really wish typescript would shut up about this. i clearly set this ref to a non-null value 2 lines up.
    if (workerPool.current != null) {
      const identifierPool = Array.from(cardIdentifiers);
      let localDownloaded = 0;

      identifierPool.map((identifier) => {
        if (workerPool.current != null) {
          workerPool.current.queue(async (download) => {
            const cardDocument = cardDocumentsByIdentifier[identifier];
            if (cardDocument != null) {
              const data = await download(identifier);
              saveAs(
                base64StringToBlob(data),
                `${cardDocument.name} (${cardDocument.identifier}).${cardDocument.extension}`
              );
            }
            localDownloaded++;
            setDownloaded(localDownloaded);
          });
        }
      });

      await workerPool.current.settled();
      await workerPool.current.terminate();

      setDownloading(false);
    }
  };

  return (
    <>
      <Dropdown.Item onClick={handleShowImagesModal}>
        <i className="bi bi-image" style={{ paddingRight: 0.5 + "em" }} /> Card
        Images
      </Dropdown.Item>
      <Modal
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
          {!downloading && cardIdentifiers.length == 0 && (
            <p>
              You&apos;ll be able to download the card images in your project
              here once you&apos;ve added some cards.
            </p>
          )}
          {!downloading && cardIdentifiers.length > 0 && (
            <>
              <p>
                Click the button below to begin. This will download the{" "}
                <b>{cardIdentifiers.length}</b> unique image
                {cardIdentifiers.length != 1 && "s"} in your project.
              </p>
              <p>This feature may not work as expected on mobile devices.</p>
              <Alert variant="info">
                If you&apos;re planning on using the {ProjectName} desktop tool
                to auto-fill your project, you don&apos;t need to download
                images here. The desktop tool will download your images for you.
              </Alert>
            </>
          )}
          {(downloading ||
            (downloaded == cardIdentifiers.length && downloaded > 0)) && (
            <>
              <StyledProgressBar
                striped
                animated={true}
                now={progress}
                label={`${downloaded} / ${cardIdentifiers.length}`}
                variant="success"
              />
              <br />
            </>
          )}
          {downloading && (
            <>
              <div className="d-grid gap-0">
                <Button variant="danger" onClick={terminate}>
                  Terminate
                </Button>
              </div>
              <br />
            </>
          )}

          <div className="d-grid gap-0">
            <Button
              variant="primary"
              onClick={downloadImages}
              disabled={downloading || cardIdentifiers.length == 0}
            >
              {downloading ? <Spinner size={1.5} /> : "Download Images"}
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
