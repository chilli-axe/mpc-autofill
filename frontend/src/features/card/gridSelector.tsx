/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
 * A generic component is provided as the basis for grid selectors.
 */

import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { Card } from "./card";
import Button from "react-bootstrap/Button";
import React from "react";

interface GridSelectorProps {
  testId: string;
  imageIdentifiers: Array<string>;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
  onClick: {
    (identifier: string): void;
  };
}

export function GridSelector(props: GridSelectorProps) {
  return (
    <Modal
      show={props.show}
      onHide={props.handleClose}
      size={"lg"}
      data-testid={props.testId}
    >
      <Modal.Header closeButton>
        <Modal.Title>Select Version</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-0" xxl={4} xl={4} lg={3} md={2} sm={2} xs={2}>
          {props.imageIdentifiers.map((identifier, index) => (
            <Card // TODO: paginate or lazy-load these
              imageIdentifier={identifier}
              cardHeaderTitle={`Option ${index + 1}`}
              cardOnClick={() => {
                props.onClick(identifier);
                props.handleClose();
              }}
              key={`gridSelector-${identifier}`}
              noResultsFound={false}
            />
          ))}
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
