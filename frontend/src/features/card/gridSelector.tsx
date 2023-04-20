/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
 * A generic component is provided as the basis for grid selectors.
 */

import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { Card } from "./card";
import Button from "react-bootstrap/Button";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";
import { CardDocument, CardDocuments } from "@/common/types";

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
  const [collapsedState, setCollapsedState] = useState<{
    [source: string]: boolean;
  }>({});
  const cardDocuments: CardDocuments = useSelector(
    (state: RootState) => state.cardDocuments.cardDocuments
  );

  const toggleSourceCollapsed = (source: string) => {
    setCollapsedState({
      ...collapsedState,
      [source]: !(collapsedState[source] ?? true),
    });
  };

  // TODO: we should probably consider returning the data from the backend like this.
  const cardIdentifiersAndOptionNumbersBySource = props.imageIdentifiers.reduce(
    (
      accumulator: { [sourceName: string]: Array<[string, number]> },
      value,
      currentIndex
    ) => {
      const cardDocument: CardDocument | null = cardDocuments[value];
      if (cardDocument != null) {
        if (
          !Object.prototype.hasOwnProperty.call(
            accumulator,
            cardDocument.source
          )
        ) {
          accumulator[cardDocument.source] = [];
        }
        accumulator[cardDocument.source].push([value, currentIndex]);
      }
      return accumulator;
    },
    {}
  );

  // TODO: paginate or lazy-load these cards. this is quite slow when you have hundreds of images.

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
        {Object.entries(cardIdentifiersAndOptionNumbersBySource).map(
          ([key, value]) => (
            <>
              <div
                key={`${key}`}
                className="d-flex justify-content-between"
                onClick={() => toggleSourceCollapsed(key)}
              >
                <h4 className="orpheus" key={`${key}-header`}>
                  <i key={`${key}-italics`}>{key}</i>
                </h4>
                <i
                  key={`${key}-arrow`}
                  className={
                    collapsedState[key] ?? true
                      ? "bi bi-chevron-down"
                      : "bi bi-chevron-left"
                  }
                ></i>
              </div>
              {(collapsedState[key] ?? true) && (
                <>
                  <hr key={`${key}-top-hr`} />
                  <Row
                    className="g-0"
                    xxl={4}
                    xl={4}
                    lg={3}
                    md={2}
                    sm={2}
                    xs={2}
                    key={`${key}-row`}
                  >
                    {value.map(([identifier, index]) => (
                      <Card
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
                </>
              )}
              <hr key={`${key}-bottom-hr`} />
            </>
          )
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
