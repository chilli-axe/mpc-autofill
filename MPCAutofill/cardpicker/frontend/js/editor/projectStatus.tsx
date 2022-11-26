import Button from "react-bootstrap/Button";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import Alert from "react-bootstrap/Alert";
import { bracket } from "./utils";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { imageSizeToMBString } from "./utils";
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";

function getProjectFileSize(): number {
  const uniqueCardIdentifiers = new Set<string>();
  for (const slotProjectMembers of useSelector(
    (state: RootState) => state.project.members
  )) {
    for (const [face, projectMember] of Object.entries(slotProjectMembers)) {
      uniqueCardIdentifiers.add(projectMember.selectedImage);
    }
  }

  const cardDocuments = useSelector(
    (state: RootState) => state.cardDocuments.cardDocuments
  );
  let projectSize = 0;
  uniqueCardIdentifiers.forEach(
    (value) => (projectSize += (cardDocuments[value] ?? { size: 0 }).size)
  );
  return projectSize;
}

export function ProjectStatus() {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  getProjectFileSize();

  const projectSize = useSelector(
    (state: RootState) => state.project.members.length
  );
  const projectFileSize = getProjectFileSize();

  return (
    <>
      <h2>Edit MPC Project</h2>
      <Alert variant="secondary">
        Your project contains <b>{projectSize}</b> card
        {projectSize !== 1 && "s"}, belongs in the MPC bracket of up to{" "}
        <b>{bracket(projectSize)}</b> cards, and is{" "}
        <b>{imageSizeToMBString(projectFileSize, 0)}</b> in total.
        <br />
        <br />
        <Row>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => <Tooltip {...props}>Save Project</Tooltip>}
              >
                <Button variant="outline-light">
                  <i
                    className="bi bi-device-ssd"
                    style={{ fontSize: 1.25 + "rem" }}
                  />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => <Tooltip {...props}>Download XML</Tooltip>}
              >
                <Button variant="outline-light">
                  <i
                    className="bi bi-file-earmark-arrow-down"
                    style={{ fontSize: 1.25 + "rem" }}
                  />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => (
                  <Tooltip {...props}>Download Decklist</Tooltip>
                )}
              >
                <Button variant="outline-light">
                  <i
                    className="bi bi-file-text"
                    style={{ fontSize: 1.25 + "rem" }}
                  />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => (
                  <Tooltip {...props}>Download Images</Tooltip>
                )}
              >
                <Button variant="outline-light">
                  <i
                    className="bi bi-images"
                    style={{ fontSize: 1.25 + "rem" }}
                  />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
        </Row>
      </Alert>
    </>
  );
}
