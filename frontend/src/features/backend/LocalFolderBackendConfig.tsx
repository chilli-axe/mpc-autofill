import React, { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

import { ProjectName } from "@/common/constants";
import { useAppDispatch, useAppStore } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { MakePlayingCardsLink } from "@/components/MakePlayingCardsLink";
import {
  BackendConfigStep,
  BackendConfigSteps,
  evaluateSteps,
  ValidationState,
} from "@/features/backend/BackendConfigSteps";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import {
  useLocalFilesDirectoryHandle,
  useLocalFilesDirectoryIndexSize,
} from "@/features/clientSearch/clientSearchHooks";
import { useGetTagsQuery } from "@/store/api";
import { setNotification } from "@/store/slices/toastsSlice";

export const LocalFolderBackendConfig = () => {
  const { clientSearchService, forceUpdate } = useClientSearchContext();
  const directoryHandle = useLocalFilesDirectoryHandle();
  const directoryIndexSize = useLocalFilesDirectoryIndexSize();
  const getTagsQuery = useGetTagsQuery();

  const [validationStatus, setValidationStatus] = useState<
    Array<ValidationState>
  >([]);
  const steps: Array<BackendConfigStep> = [
    {
      label: "Choosing directory",
      callable: async () => {
        try {
          const handle: FileSystemDirectoryHandle =
            // @ts-ignore
            await window.showDirectoryPicker({ mode: "readwrite" });
          return { success: true, nextArg: handle };
        } catch (error) {
          if (!(error instanceof DOMException)) {
            dispatch(
              setNotification([
                Math.random().toString(),
                {
                  name: "Opening Local Folders is Unsupported",
                  message:
                    "Your browser doesn't support opening local folders. Sorry about that!",
                  level: "warning",
                },
              ])
            );
          }
          return { success: false };
        }
      },
    },
    {
      label: "Indexing files",
      callable: async (handle: FileSystemDirectoryHandle) =>
        clientSearchService
          .setDirectoryHandle(
            handle,
            store.getState(),
            dispatch,
            forceUpdate,
            getTagsQuery.data
          )
          .then(() => ({ success: true })),
    },
  ];

  const dispatch = useAppDispatch();
  const store = useAppStore();

  const chooseDirectory = async () => evaluateSteps(steps, setValidationStatus);

  const clearDirectoryChoice = async () => {
    await clientSearchService.clearDirectoryHandle(store.getState(), dispatch);
    forceUpdate();
    if (directoryHandle !== undefined) {
      dispatch(
        setNotification([
          Math.random().toString(),
          {
            name: `Removed ${directoryHandle.name}`,
            message: null,
            level: "info",
          },
        ])
      );
    }
    setValidationStatus([]);
  };
  return (
    <>
      <h4>Local Folder</h4>
      {directoryHandle !== undefined && (
        <Alert variant="success">
          You&apos;re connected to <b>{directoryHandle.name}</b>, with{" "}
          <b>{directoryIndexSize ?? 0}</b> images indexed.
          <Row className="gx-1 pt-2">
            <Col xs={6}>
              <div className="d-grid gap-0">
                <Button
                  variant="primary"
                  onClick={async () =>
                    clientSearchService.indexDirectory(
                      dispatch,
                      forceUpdate,
                      getTagsQuery.data
                    )
                  }
                >
                  <RightPaddedIcon bootstrapIconName="arrow-repeat" />
                  Synchronise
                </Button>
              </div>
            </Col>
            <Col xs={6}>
              <div className="d-grid gap-0">
                <Button variant="danger" onClick={clearDirectoryChoice}>
                  <RightPaddedIcon bootstrapIconName="eject" />
                  Disconnect
                </Button>
              </div>
            </Col>
          </Row>
        </Alert>
      )}
      <p>
        Choose a folder on your computer you&apos;d like to connect{" "}
        {ProjectName} to.
      </p>
      <ul>
        <li>
          Image files in this folder are searchable in the {ProjectName} editor.
        </li>
        <li>
          You can generate XML files referring to images in this folder to
          upload to <MakePlayingCardsLink />.
        </li>
        <li>Any files you download will go into this folder.</li>
      </ul>
      <p>
        This feature only works in <b>Google Chrome</b>.
      </p>
      <BackendConfigSteps validationStatus={validationStatus} steps={steps} />
      <Row className="g-0">
        <Button
          variant="outline-primary"
          onClick={chooseDirectory}
          disabled={directoryHandle !== undefined}
        >
          <RightPaddedIcon bootstrapIconName="plus-circle" />
          Choose Folder
        </Button>
      </Row>
    </>
  );
};
