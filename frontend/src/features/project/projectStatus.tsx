import { saveAs } from "file-saver";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Row from "react-bootstrap/Row";
import Tooltip from "react-bootstrap/Tooltip";
import { useSelector } from "react-redux";

import { ProjectMaxSize } from "@/common/constants";
import { bracket, imageSizeToMBString } from "@/common/utils";
import {
  selectGeneratedDecklist,
  selectGeneratedXML,
  selectProjectFileSize,
  selectProjectSize,
} from "@/features/project/projectSlice";

// TODO: review the codebase for instances of this https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization

export function ProjectStatus() {
  // const [show, setShow] = useState(false);
  // const handleClose = () => setShow(false);
  // const handleShow = () => setShow(true);

  const generatedXML = useSelector(selectGeneratedXML);
  const generatedDecklist = useSelector(selectGeneratedDecklist);
  const projectSize = useSelector(selectProjectSize);
  const projectFileSize = useSelector(selectProjectFileSize);

  // TODO: read project name for these file names
  const exportXML = () =>
    saveAs(
      new Blob([generatedXML], { type: "text/plain;charset=utf-8" }),
      "cards.xml"
    );
  const exportDecklist = () =>
    saveAs(
      new Blob([generatedDecklist], { type: "text/xml;charset=utf-8" }),
      "decklist.txt"
    );

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
                <Button
                  variant="outline-light"
                  onClick={exportXML}
                  data-testid="download-xml"
                >
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
                <Button
                  variant="outline-light"
                  onClick={exportDecklist}
                  data-testid="download-decklist"
                >
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
