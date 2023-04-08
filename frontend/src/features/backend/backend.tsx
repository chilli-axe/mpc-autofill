/**
 * This component allows users to configure which backend server the frontend should retrieve data from.
 */

import Offcanvas from "react-bootstrap/Offcanvas";
import Button from "react-bootstrap/Button";
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/store";
import Form from "react-bootstrap/Form";
import Nav from "react-bootstrap/Nav";
import { setURL } from "@/features/backend/backendSlice";
import { ProjectName } from "@/common/constants";

interface BackendConfigProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function BackendConfig(props: BackendConfigProps) {
  const dispatch = useDispatch();

  const [serverURL, setServerURL] = useState<string>("");

  const handleSubmit = async () => {
    dispatch(setURL(serverURL));
    props.handleClose();
  };

  return (
    <>
      <Offcanvas show={props.show} onHide={props.handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Server Configuration</Offcanvas.Title>
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
