import { saveAs } from "file-saver";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Row from "react-bootstrap/Row";
import Tooltip from "react-bootstrap/Tooltip";
import { useSelector, useStore } from "react-redux";
import styled from "styled-components";
import { UAParser } from "ua-parser-js";

import { ProjectMaxSize, ProjectName } from "@/common/constants";
import { bracket, imageSizeToMBString } from "@/common/utils";
import { SelectedImagesStatus } from "@/features/project/bulkManagement";
import {
  selectGeneratedDecklist,
  selectGeneratedXML,
  selectProjectFileSize,
  selectProjectSize,
} from "@/features/project/projectSlice";

function MobileAlert() {
  const ua = UAParser();
  return ua.device.type === "mobile" ? (
    <Alert variant="primary">
      It seems like you&apos;re on a mobile device! The {ProjectName} executable
      that fills your order into MPC requires a desktop computer.
    </Alert>
  ) : (
    <></>
  );
}

// TODO: review the codebase for instances of this https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization

const SizedIcon = styled.i`
  font-size: 1.25rem;
`;

export function ProjectStatus() {
  const store = useStore();
  const projectSize = useSelector(selectProjectSize);
  const projectFileSize = useSelector(selectProjectFileSize);

  // TODO: read project name for these file names
  // note: these functions use the store directly rather than `useSelector`
  // to avoid recalculating XML and decklist every time state changes
  const exportXML = () => {
    const generatedXML = selectGeneratedXML(store.getState());
    saveAs(
      new Blob([generatedXML], { type: "text/xml;charset=utf-8" }),
      "cards.xml"
    );
  };
  const exportDecklist = () => {
    const generatedDecklist = selectGeneratedDecklist(store.getState());
    saveAs(
      new Blob([generatedDecklist], { type: "text/plain;charset=utf-8" }),
      "decklist.txt"
    );
  };

  return (
    <>
      <h2>Edit MPC Project</h2>
      <MobileAlert />
      <SelectedImagesStatus />
      <Alert variant="secondary">
        Your project contains <b>{projectSize}</b> card
        {projectSize !== 1 && "s"}, belongs in the MPC bracket of up to{" "}
        <b>{bracket(projectSize)}</b> cards, and is{" "}
        <b>{imageSizeToMBString(projectFileSize, 0)}</b> in total.
        <br />
        <br />
        {projectSize >= ProjectMaxSize && (
          <Alert variant="warning">
            You&apos;ve reached the maximum project size!
          </Alert>
        )}
        <Row>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => <Tooltip {...props}>Save Project</Tooltip>}
              >
                <Button variant="outline-light">
                  <SizedIcon className="bi bi-device-ssd" />
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
                <Button
                  variant="outline-light"
                  onClick={exportXML}
                  data-testid="download-xml"
                >
                  <SizedIcon className="bi bi-file-earmark-arrow-down" />
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
                <Button
                  variant="outline-light"
                  onClick={exportDecklist}
                  data-testid="download-decklist"
                >
                  <SizedIcon className="bi bi-file-text" />
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
                  <SizedIcon className="bi bi-images" />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
        </Row>
      </Alert>
    </>
  );
}
