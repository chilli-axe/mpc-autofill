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

interface BackendConfigProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function BackendConfig(props: BackendConfigProps) {
  const dispatch = useDispatch();

  const [triggerFn, getBackendInfoQuery] =
    apiSlice.endpoints.getBackendInfo.useLazyQuery();

  // TODO: these variable names are mad confusing
  const [serverURL, setServerURL] = useState<string>("");

  const handleSubmit = async () => {
    dispatch(setURL(serverURL));
    setCookieBackendURL(serverURL);
    dispatch(apiSlice.util.resetApiState());
    triggerFn();
    props.handleClose();
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
            <Button variant="primary" onClick={handleSubmit}>
              Submit
            </Button>
          </Form>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
