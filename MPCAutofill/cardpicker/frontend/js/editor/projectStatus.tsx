require("bootstrap-icons/font/bootstrap-icons.css");
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import Alert from "react-bootstrap/Alert";
import { bracket } from "./utils";

export function ProjectStatus() {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const projectSize = useSelector(
    (state: RootState) => Object.keys(state.project).length
  );

  return (
    <>
      <h2>Edit MPC Project</h2>
      <Alert variant="secondary">
        Your project contains <b>{projectSize}</b> card
        {projectSize !== 1 && "s"} and belongs in the MPC bracket of up to{" "}
        <b>{bracket(projectSize)}</b> cards.
      </Alert>
    </>
  );
}
