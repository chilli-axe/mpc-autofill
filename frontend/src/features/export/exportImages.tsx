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
import { useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { selectIsProjectEmpty } from "@/features/project/projectSlice";
import { useCardDocumentsByIdentifier } from "@/features/search/cardDocumentsSlice";
import { setError } from "@/features/toasts/toastsSlice";

const StyledProgressBar = styled(ProgressBar)`
  --bs-progress-bg: #424e5c;
`;

export function ExportImages() {
  const dispatch = useAppDispatch();
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  const [showImagesModal, setShowImagesModal] = useState<boolean>(false);
  const handleCloseImagesModal = () => setShowImagesModal(false);
  const handleShowImagesModal = () => setShowImagesModal(true);

  const [downloading, setDownloading] = useState<boolean>(false);

  const cardDocumentsByIdentifier = useCardDocumentsByIdentifier();
  const identifierCount = Object.keys(cardDocumentsByIdentifier).length;

  const [downloaded, setDownloaded] = useState<number>(0);
  const progress = (100 * downloaded) / identifierCount;

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
      let localDownloaded = 0;

      Object.keys(cardDocumentsByIdentifier).map((identifier) => {
        if (workerPool.current != null) {
          workerPool.current.queue(async (download) => {
            const cardDocument = cardDocumentsByIdentifier[identifier];
            if (cardDocument != null) {
              try {
                const data = await download(identifier);
                saveAs(
                  base64StringToBlob(data),
                  `${cardDocument.name} (${cardDocument.identifier}).${cardDocument.extension}`
                );
              } catch (error) {
                dispatch(
                  setError([
                    `download-${cardDocument.identifier}-failed`,
                    {
                      name: "Failed to download image",
                      message: `Downloading the full`,
                    },
                  ])
                );
              }
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
          {(downloading ||
            (downloaded == identifierCount && downloaded > 0)) && (
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
              disabled={downloading || identifierCount == 0}
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
