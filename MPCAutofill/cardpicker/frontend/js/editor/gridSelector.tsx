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

interface CardSlotGridSelectorProps {
  face: Faces;
  slot: number;
  searchResultsForQuery: Array<string>;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

interface CommonCardbackGridSelectorProps {
  searchResults: Array<string>;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

function GridSelector(props: GridSelectorProps) {
  return (
    <Modal show={props.show} onHide={props.handleClose} size={"lg"}>
      <Modal.Header closeButton>
        <Modal.Title>Select Version</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-0" xxl={4} xl={4} lg={3} md={2} sm={2} xs={2}>
          {props.imageIdentifiers.map((identifier, index) => (
            <Card // TODO: paginate or lazy-load these
              imageIdentifier={identifier}
              cardHeaderTitle={`Option ${index + 1}`}
              imageOnClick={() => {
                props.onClick(identifier);
                props.handleClose();
              }}
              key={`gridSelector-${identifier}`}
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

export function CardSlotGridSelector(props: CardSlotGridSelectorProps) {
  const dispatch = useDispatch<AppDispatch>();
  function setSelectedImageFromIdentifier(selectedImage: string): void {
    dispatch(
      setSelectedImage({ face: props.face, slot: props.slot, selectedImage })
    );
  }
  return (
    <GridSelector
      imageIdentifiers={props.searchResultsForQuery}
      show={props.show}
      handleClose={props.handleClose}
      onClick={setSelectedImageFromIdentifier}
    />
    // <GridSelector face={} slot={} searchResultsForQuery={} show={} handleClose={}/>
  );
}

export function CommonCardbackGridSelector(
  props: CommonCardbackGridSelectorProps
) {
  const dispatch = useDispatch<AppDispatch>();
  function setSelectedImageFromIdentifier(selectedImage: string): void {
    alert("todo");
    // dispatch(
    //   setSelectedImage({face: props.face, slot: props.slot, selectedImage})
    // );
  }
  return (
    <GridSelector
      imageIdentifiers={props.searchResults}
      show={props.show}
      handleClose={props.handleClose}
      onClick={setSelectedImageFromIdentifier}
    />
    // <GridSelector face={} slot={} searchResultsForQuery={} show={} handleClose={}/>
  );
}
