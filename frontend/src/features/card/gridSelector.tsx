/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
 * Card versions are faceted by source, and all cards for a source can be temporarily hidden.
 */

import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { Card } from "./card";
import Button from "react-bootstrap/Button";
import React, { useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/store";
import { CardDocument } from "@/common/types";
import { toggleSourceVisible } from "@/features/viewSettings/viewSettingsSlice";

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
  const cardDocuments = useSelector(
    (state: RootState) => state.cardDocuments.cardDocuments
  );
  const sourcesVisible = useSelector(
    (state: RootState) => state.viewSettings.sourcesVisible
  );
  const dispatch = useDispatch();

  const cardIdentifiersAndOptionNumbersBySource = useMemo(
    () =>
      props.imageIdentifiers.reduce(
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
      ),
    [cardDocuments, props.imageIdentifiers]
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
          ([key, value], sourceIndex) => (
            <>
              <div
                className="sticky-top"
                onClick={() => dispatch(toggleSourceVisible(key))}
                style={{
                  backgroundColor: "#4E5D6B",
                  zIndex: sourceIndex + 100,
                }}
              >
                <hr key={`${key}-top-hr`} />
                <div key={`${key}`} className="d-flex justify-content-between">
                  <h4
                    className="orpheus prevent-select ms-2"
                    key={`${key}-header`}
                  >
                    <i key={`${key}-italics`}>{key}</i>
                  </h4>
                  <h4
                    key={`${key}-arrow`}
                    className={`me-2 bi bi-chevron-left rotate-${
                      sourcesVisible[key] ?? true ? "" : "neg"
                    }90`}
                    style={{ transition: "all 0.25s 0s" }}
                  ></h4>
                </div>
                {(sourcesVisible[key] ?? true) && (
                  <hr key={`${key}-bottom-hr`} />
                )}
              </div>

              {(sourcesVisible[key] ?? true) && (
                <>
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
