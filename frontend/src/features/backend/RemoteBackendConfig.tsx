// TODO: https://github.com/alfg/ping.js/issues/29#issuecomment-487240910
// @ts-ignore
import Ping from "ping.js";
import React, { FormEvent, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";

import { ProjectName } from "@/common/constants";
import {
  clearLocalStorageBackendURL,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import { useAppDispatch, useAppSelector, useAppStore } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import {
  BackendConfigStep,
  BackendConfigSteps,
  evaluateSteps,
  ValidationState,
} from "@/features/backend/BackendConfigSteps";
import { recalculateSearchResults } from "@/store/listenerMiddleware";
import {
  clearURL,
  selectRemoteBackendURL,
  setURL,
} from "@/store/slices/backendSlice";

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

export const RemoteBackendConfig = () => {
  //# region queries and hooks
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const backendURL = useAppSelector(selectRemoteBackendURL);

  //# endregion

  //# region state

  const [validationStatus, setValidationStatus] = useState<
    Array<ValidationState>
  >([]);
  const [validating, setValidating] = useState<boolean>(false);
  const [localBackendURL, setLocalBackendURL] = useState<string>("");

  const formattedURL = standardiseURL(localBackendURL.trim());

  const steps: Array<BackendConfigStep> = [
    {
      label: "Validating URL",
      callable: async () => ({
        success: await validateURLStructure(formattedURL),
      }),
    },
    {
      label: "Pinging server",
      callable: async () => ({ success: await pingBackend(formattedURL) }),
    },
    {
      label: "Checking search engine health",
      callable: async () => ({
        success: await searchEngineHealthCheck(formattedURL),
      }),
    },
  ];

  //# endregion

  //# region callbacks

  const clearBackendURL = () => {
    dispatch(clearURL());
    clearLocalStorageBackendURL();
    setValidationStatus([]);
    recalculateSearchResults(store.getState(), dispatch, true);
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // to avoid reloading the page
    setValidating(true);
    const validated = await evaluateSteps(steps, setValidationStatus);
    if (validated) {
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
        <BackendConfigSteps validationStatus={validationStatus} steps={steps} />
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
