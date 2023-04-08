/**
 * This component allows users to configure which backend server the frontend should retrieve data from.
 */

import Offcanvas from "react-bootstrap/Offcanvas";
import Button from "react-bootstrap/Button";
import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import Form from "react-bootstrap/Form";
import Nav from "react-bootstrap/Nav";
import { setURL } from "@/features/backend/backendSlice";
import { ProjectName } from "@/common/constants";
import { getCookieBackendURL, setCookieBackendURL } from "@/common/cookies";
import { apiSlice } from "@/app/api";
import { withHttp } from "@/common/processing";
// TODO: https://github.com/alfg/ping.js/issues/29#issuecomment-487240910
// @ts-ignore
import Ping from "ping.js";
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

function validateURLStructure(
  url: string,
  validationStatus: Array<ValidationState>
) {
  try {
    new URL(url);
    validationStatus = [
      ...validationStatus.slice(0, -1),
      ValidationState.SUCCEEDED,
    ];
  } catch (error) {
    validationStatus = [
      ...validationStatus.slice(0, -1),
      ValidationState.FAILED,
    ];
  }
  return validationStatus;
}

async function pingBackend(
  url: string,
  validationStatus: Array<ValidationState>
): Promise<Array<ValidationState>> {
  try {
    const p = new Ping();
    await p.ping(url, function (err: any, data: any) {
      validationStatus = [
        ...validationStatus.slice(0, -1),
        err ? ValidationState.FAILED : ValidationState.SUCCEEDED,
      ];
    });
  } catch (error) {
    validationStatus = [
      ...validationStatus.slice(0, -1),
      ValidationState.FAILED,
    ];
  }
  return validationStatus;
}

async function searchEngineHealthCheck(
  url: string,
  validationStatus: Array<ValidationState>
): Promise<Array<ValidationState>> {
  try {
    await fetch(new URL("2/searchEngineHealth/", url).toString(), {
      method: "GET",
      mode: "cors",
    })
      .then((response) => response.json())
      .then((data) => {
        validationStatus = [
          ...validationStatus.slice(0, -1),
          (data.online ?? false) === true
            ? ValidationState.SUCCEEDED
            : ValidationState.FAILED,
        ];
      });
  } catch (error) {
    validationStatus = [
      ...validationStatus.slice(0, -1),
      ValidationState.FAILED,
    ];
  }
  return validationStatus;
}

export function BackendConfig(props: BackendConfigProps) {
  const dispatch = useDispatch();

  const [validationStatus, setValidationStatus] = useState<
    Array<ValidationState>
  >([]);

  const [triggerFn, getBackendInfoQuery] =
    apiSlice.endpoints.getBackendInfo.useLazyQuery();

  // TODO: these variable names are mad confusing
  const [serverURL, setServerURL] = useState<string>("");

  const handleSubmit = async () => {
    const formattedURL = withHttp(serverURL.trim());

    let updatedValidationStatus: Array<ValidationState> = [];
    setValidationStatus(updatedValidationStatus);

    // ensure the URL provided by the user is valid
    updatedValidationStatus = [
      ...updatedValidationStatus,
      ValidationState.IN_PROGRESS,
    ];
    setValidationStatus(updatedValidationStatus);
    updatedValidationStatus = validateURLStructure(
      formattedURL,
      updatedValidationStatus
    );
    setValidationStatus(updatedValidationStatus);

    // ping the server to check if it's alive
    if (
      updatedValidationStatus[updatedValidationStatus.length - 1] !=
      ValidationState.FAILED
    ) {
      updatedValidationStatus = [
        ...updatedValidationStatus,
        ValidationState.IN_PROGRESS,
      ];
      setValidationStatus(updatedValidationStatus);
      updatedValidationStatus = await pingBackend(
        formattedURL,
        updatedValidationStatus
      );
      setValidationStatus(updatedValidationStatus);
    }

    // ping the search engine to see if it's alive
    if (
      updatedValidationStatus[updatedValidationStatus.length - 1] !=
      ValidationState.FAILED
    ) {
      updatedValidationStatus = [
        ...updatedValidationStatus,
        ValidationState.IN_PROGRESS,
      ];
      setValidationStatus(updatedValidationStatus);
      updatedValidationStatus = await searchEngineHealthCheck(
        formattedURL,
        updatedValidationStatus
      );
      setValidationStatus(updatedValidationStatus);
    }

    // set state in redux and cookies + clean up API cached data
    if (
      updatedValidationStatus.every(
        (item) => item === ValidationState.SUCCEEDED
      )
    ) {
      dispatch(setURL(formattedURL));
      setCookieBackendURL(formattedURL);
      dispatch(apiSlice.util.resetApiState());
      triggerFn();
    }
  };

  useEffect(() => {
    const backendURL = getCookieBackendURL();
    if (backendURL != undefined) {
      setServerURL(backendURL);
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
          Enter the URL of the server you&apos;d like to connect {ProjectName}{" "}
          to.
          <br />
          <br />
          <Form>
            <Form.Group className="mb-3" controlId="formURL">
              <Form.Control
                placeholder="https://"
                onChange={(event) => setServerURL(event.target.value)}
                value={serverURL}
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
            <Button variant="primary" onClick={handleSubmit}>
              Submit
            </Button>
          </Form>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
