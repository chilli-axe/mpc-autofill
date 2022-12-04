import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { Card } from "./card";
import Button from "react-bootstrap/Button";
import React from "react";
import { setSelectedImage } from "./projectSlice";
import { useDispatch } from "react-redux";
import { AppDispatch } from "./store";
import { Faces } from "./constants";

interface GridSelectorProps {
  face: Faces;
  slot: number;
  searchResultsForQuery: Array<string>;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function GridSelector(props: GridSelectorProps) {
  const dispatch = useDispatch<AppDispatch>();
  function setSelectedImageFromIdentifier(selectedImage: string): void {
    dispatch(
      setSelectedImage({ face: props.face, slot: props.slot, selectedImage })
    );
  }

  return (
    <Modal show={props.show} onHide={props.handleClose} size={"lg"}>
      <Modal.Header closeButton>
        <Modal.Title>Select Version</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-0" xxl={4} xl={4} lg={3} md={2} sm={2} xs={2}>
          {props.searchResultsForQuery.map((identifier, index) => (
            <Card // TODO: paginate or lazy-load these
              imageIdentifier={identifier}
              cardHeaderTitle={`Option ${index + 1}`}
              imageOnClick={() => {
                setSelectedImageFromIdentifier(identifier);
                props.handleClose();
              }}
              key={`${props.face}-${props.slot}-${identifier}`}
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
