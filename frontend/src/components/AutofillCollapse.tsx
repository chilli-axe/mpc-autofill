import React, { ReactElement } from "react";
import Card from "react-bootstrap/Card";
import Collapse from "react-bootstrap/Collapse";
import Container from "react-bootstrap/Container";
import Stack from "react-bootstrap/Stack";

interface AutofillCollapseProps {
  expanded: boolean;
  onClick: () => void;
  zIndex?: number;
  title: ReactElement | string;
  subtitle?: string;
  children: ReactElement;
  sticky?: boolean;
  pad?: number;
}

/**
 * bit of a shitty component name sorry
 * @param children Children to render in the body of this collapsible man
 * @param expanded Whether this collapsible man is expanded
 * @param onClick What to do when trying to expand this man
 * @param zIndex The base z-index of this man
 * @param title The title of this man
 * @param subtitle Optionally, the subtitle of this man
 * @param sticky Whether or not the man's collapse bar is sticky
 * @constructor
 */
export function AutofillCollapse({
  children,
  expanded,
  onClick,
  zIndex = 0,
  title,
  subtitle,
  sticky = false,
  pad = 0,
}: AutofillCollapseProps) {
  return (
    <>
      <Card style={{ position: "relative", zIndex }}>
        <Card.Header
          className={`border-light${sticky ? " sticky-top" : ""}`}
          onClick={onClick}
          style={{
            backgroundColor: "#4E5D6B",
            zIndex: zIndex + 1,
            cursor: "pointer",
          }}
        >
          <Stack direction="horizontal" gap={2} className="d-flex px-0">
            {title}
            {subtitle && (
              <h6 className="text-primary prevent-select">{subtitle}</h6>
            )}
            <button className="ms-auto bg-transparent border-0">
              <h5
                className={`bi bi-chevron-left rotate-${
                  expanded ? "" : "neg"
                }90`}
                style={{ transition: "all 0.25s 0s", color: "white" }}
              />
            </button>
          </Stack>
        </Card.Header>
        <Card.Body className={`p-0 m-0`}>
          <Collapse in={expanded}>
            {/* https://react-bootstrap.netlify.app/docs/utilities/transitions/#collapse */}
            <div>
              <Container className={`p-${pad} m-0`}>{children}</Container>
            </div>
          </Collapse>
        </Card.Body>
      </Card>
      {/* <div

        onClick={onClick}

      >
        <hr className="mt-0" />
        <Stack direction="horizontal" gap={2} className="d-flex ps-3 pe-3">
          {title}
          {subtitle && (
            <h6 className="text-primary prevent-select">{subtitle}</h6>
          )}

          <button className="ms-auto bg-transparent border-0">
            <h4
              className={`bi bi-chevron-left rotate-${expanded ? "" : "neg"}90`}
              style={{ transition: "all 0.25s 0s" }}
            />
          </button>
        </Stack>
        <hr className="mb-0" />
      </div>
      <div className="py-2" />
      <Collapse in={expanded}>
        <div>{children}</div>
      </Collapse> */}
    </>
  );
}
