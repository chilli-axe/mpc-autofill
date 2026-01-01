/**
 * This component allows users to configure which backend server the frontend should retrieve data from.
 */

import styled from "@emotion/styled";
// TODO: https://github.com/alfg/ping.js/issues/29#issuecomment-487240910
// @ts-ignore
import Ping from "ping.js";
import React, { FormEvent, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Offcanvas from "react-bootstrap/Offcanvas";
import Row from "react-bootstrap/Row";

import { ProjectName } from "@/common/constants";
import { MakePlayingCards, MakePlayingCardsURL } from "@/common/constants";
import {
  clearLocalStorageBackendURL,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { AutofillTable } from "@/components/AutofillTable";
import { RightPaddedIcon } from "@/components/icon";
import { getEnvURL } from "@/features/backend/BackendSetter";
import { useLocalFilesContext } from "@/features/localFiles/localFilesContext";
import {
  clearURL,
  selectRemoteBackendURL,
  setURL,
} from "@/store/slices/backendSlice";
import { useProjectName } from "@/store/slices/backendSlice";
import { setNotification } from "@/store/slices/toastsSlice";

require("bootstrap-icons/font/bootstrap-icons.css");

enum ValidationState {
  IN_PROGRESS = "record-circle-fill",
  SUCCEEDED = "check-circle-fill",
  FAILED = "x-circle-fill",
}

const urlValidationStages = [
  "Validating URL",
  "Pinging server",
  "Checking search engine health",
];

function validateURLStructure(url: string): boolean {
  // ensure the URL provided by the user is valid
  let outcome = false;
  try {
    new URL(url);
    outcome = true;
  } catch (error) {}
  return outcome;
}

async function pingBackend(url: string): Promise<boolean> {
  // ping the server to check if it's alive
  let outcome = false;
  try {
    const p = new Ping();
    await p.ping(url, function (err: any, data: any) {
      outcome = err == null;
    });
  } catch (error) {}
  return outcome;
}

async function searchEngineHealthCheck(url: string): Promise<boolean> {
  // ping the search engine to see if it's alive
  let outcome = false;
  try {
    await fetch(new URL("2/searchEngineHealth/", url).toString(), {
      method: "GET",
      mode: "cors",
    })
      .then((response) => response.json())
      .then((data) => {
        outcome = (data.online ?? false) === true;
      });
  } catch (error) {}
  return outcome;
}

const TableButton = styled.i`
  cursor: pointer;
`;

interface BackendConfigProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

const RemoteBackendConfig = () => {
  //# region queries and hooks
  const dispatch = useAppDispatch();
  const backendURL = useAppSelector(selectRemoteBackendURL);

  //# endregion

  //# region state

  const [validationStatus, setValidationStatus] = useState<
    Array<ValidationState>
  >([]);
  const [validating, setValidating] = useState<boolean>(false);
  const [localBackendURL, setLocalBackendURL] = useState<string>("");

  //# endregion

  //# region callbacks

  const clearBackendURL = () => {
    dispatch(clearURL());
    clearLocalStorageBackendURL();
    setValidationStatus([]);
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // to avoid reloading the page
    setValidating(true);
    const formattedURL = standardiseURL(localBackendURL.trim());

    let updatedValidationStatus: Array<ValidationState> = [];
    setValidationStatus(updatedValidationStatus);

    for (const validationFn of [
      validateURLStructure,
      pingBackend,
      searchEngineHealthCheck,
    ]) {
      updatedValidationStatus.push(ValidationState.IN_PROGRESS);
      setValidationStatus(updatedValidationStatus);
      const outcome = await validationFn(formattedURL);
      updatedValidationStatus = [
        ...updatedValidationStatus.slice(0, -1),
        outcome ? ValidationState.SUCCEEDED : ValidationState.FAILED,
      ];
      setValidationStatus(updatedValidationStatus);
      if (!outcome) {
        break;
      }
    }

    // set state in redux and cookies + clean up API cached data
    if (
      updatedValidationStatus.every(
        (item) => item === ValidationState.SUCCEEDED
      )
    ) {
      dispatch(setURL(formattedURL));
      setLocalStorageBackendURL(formattedURL);
      setLocalBackendURL("");
    }
    setValidating(false);
  };

  //# endregion

  return (
    <>
      <h4>Server</h4>
      {backendURL != null && (
        <Alert variant="success">
          You&apos;re connected to <b>{backendURL}</b>.
          <br />
          <br />
          <div className="d-grid gap-0">
            <Button variant="danger" onClick={clearBackendURL}>
              <RightPaddedIcon bootstrapIconName="eject" />
              Disconnect
            </Button>
          </div>
        </Alert>
      )}
      Enter the URL of the server you&apos;d like to connect {ProjectName} to
      and hit <b>Submit</b>.
      <br />
      <br />
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="formURL">
          <Form.Control
            type="url"
            placeholder="https://"
            onChange={(event) => setLocalBackendURL(event.target.value)}
            value={localBackendURL}
            disabled={validating}
            aria-label="backend-url"
          />
        </Form.Group>
        {validationStatus.length > 0 && (
          <>
            <ul>
              {urlValidationStages.map((item, i) => (
                <li key={item}>
                  <RightPaddedIcon
                    bootstrapIconName={validationStatus[i] ?? "circle"}
                  />{" "}
                  {item}
                  {validationStatus[i] === ValidationState.IN_PROGRESS && "..."}
                </li>
              ))}
            </ul>
          </>
        )}
        <Button
          variant="primary"
          type="submit"
          disabled={validating || localBackendURL.trim().length == 0}
          aria-label="submit-backend-url"
        >
          Submit
        </Button>
      </Form>
    </>
  );
};

const LocalBackendConfig = () => {
  const { localFilesService, forceUpdate } = useLocalFilesContext();
  const directoryHandle = localFilesService.getDirectoryHandle();
  const directoryIndex = localFilesService.getDirectoryIndex();

  const dispatch = useAppDispatch();

  const chooseDirectory = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      localFilesService.setDirectoryHandle(handle, dispatch);
      await localFilesService.indexDirectory(dispatch, forceUpdate);
    } catch (e) {
      // TODO: catch specific errors from `showDirectoryPicker`
      // RIP firefox :(
      console.log(e);
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
  };

  const clearDirectoryChoice = async () => {
    localFilesService.setDirectoryHandle(undefined, dispatch);
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
  };
  return (
    <>
      <h4>Local Folder</h4>
      {directoryHandle !== undefined && (
        <Alert variant="success">
          You&apos;re connected to <b>{directoryHandle.name}</b>, with{" "}
          <b>{directoryIndex?.index?.size ?? 0}</b> images indexed.
          <Row className="gx-1 pt-2">
            <Col xs={6}>
              <div className="d-grid gap-0">
                <Button
                  variant="primary"
                  onClick={() =>
                    localFilesService.indexDirectory(dispatch, forceUpdate)
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
          upload to{" "}
          <a href={MakePlayingCardsURL} target="_blank">
            {MakePlayingCards}
          </a>
          .<li>Any files you download will go into this folder.</li>
        </li>
      </ul>
      <p>
        This feature only works in <b>Google Chrome</b>.
      </p>
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

export function BackendConfig({ show, handleClose }: BackendConfigProps) {
  const envURL = getEnvURL();
  return (
    <Offcanvas show={show} onHide={handleClose} data-testid="backend-offcanvas">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Configure Sources</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {envURL === undefined && (
          <>
            <RemoteBackendConfig />
            <hr />
          </>
        )}
        <LocalBackendConfig />
      </Offcanvas.Body>
    </Offcanvas>
  );
}
