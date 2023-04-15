/**
 * This component allows users to configure which backend server the frontend should retrieve data from.
 */

import Alert from "react-bootstrap/Alert";
import Offcanvas from "react-bootstrap/Offcanvas";
import Button from "react-bootstrap/Button";
import React, { useState, useEffect, FormEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import Form from "react-bootstrap/Form";
import { clearURL, setURL } from "@/features/backend/backendSlice";
import { ProjectName } from "@/common/constants";
import {
  clearLocalStorageBackendURL,
  getLocalStorageBackendURL,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { apiSlice } from "@/app/api";
import { standardiseURL } from "@/common/processing";
// TODO: https://github.com/alfg/ping.js/issues/29#issuecomment-487240910
// @ts-ignore
import Ping from "ping.js";
import { RootState } from "@/app/store";
require("bootstrap-icons/font/bootstrap-icons.css");

interface BackendConfigProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

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

export function BackendConfig(props: BackendConfigProps) {
  const dispatch = useDispatch();

  const [validationStatus, setValidationStatus] = useState<
    Array<ValidationState>
  >([]);
  const [validating, setValidating] = useState<boolean>(false);

  const [triggerFn, getBackendInfoQuery] =
    apiSlice.endpoints.getBackendInfo.useLazyQuery();

  const backendURL = useSelector((state: RootState) => state.backend.url);
  const clearBackendURL = () => {
    dispatch(clearURL());
    clearLocalStorageBackendURL();
    dispatch(apiSlice.util.resetApiState());
    setValidationStatus([]);
  };

  const [localBackendURL, setLocalBackendURL] = useState<string>("");

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
      dispatch(apiSlice.util.resetApiState());
      setLocalBackendURL("");
      triggerFn();
    }
    setValidating(false);
  };

  useEffect(() => {
    const backendURL = getLocalStorageBackendURL();
    if (backendURL != undefined) {
      dispatch(setURL(backendURL));
      dispatch(apiSlice.util.resetApiState());
      triggerFn();
    }
  }, []);

  return (
    <>
      <Offcanvas show={props.show} onHide={props.handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Configure Server</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {backendURL != null && (
            <Alert variant="success">
              You&apos;re currently connected to <b>{backendURL}</b>.
              <br />
              <br />
              <Button variant="danger" onClick={clearBackendURL}>
                Disconnect
              </Button>
            </Alert>
          )}
          Enter the URL of the server you&apos;d like to connect {ProjectName}{" "}
          to and hit <b>Submit</b>.
          <br />
          <br />
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formURL">
              <Form.Control
                placeholder="https://"
                onChange={(event) => setLocalBackendURL(event.target.value)}
                value={localBackendURL}
                disabled={validating}
              />
            </Form.Group>
            {validationStatus.length > 0 && (
              <>
                <hr />
                <ul>
                  {urlValidationStages.map((item, i) => (
                    <li key={item}>
                      <i
                        className={`bi bi-${validationStatus[i] ?? "circle"}`}
                      />{" "}
                      {item}
                      {validationStatus[i] === ValidationState.IN_PROGRESS &&
                        "..."}
                    </li>
                  ))}
                </ul>
                <hr />
              </>
            )}
            <Button
              variant="primary"
              type="submit"
              disabled={validating || localBackendURL.trim().length == 0}
            >
              Submit
            </Button>
          </Form>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
