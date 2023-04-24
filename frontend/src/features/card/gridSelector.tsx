/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
 * Card versions are faceted by source, and all cards for a source can be temporarily hidden.
 */

import Collapse from "react-bootstrap/Collapse";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { Card } from "./card";
import Button from "react-bootstrap/Button";
import React, { useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/store";
import { CardDocument } from "@/common/types";
import {
  toggleSourceVisible,
  makeAllSourcesVisible,
  toggleFacetBySource,
} from "@/features/viewSettings/viewSettingsSlice";
import Col from "react-bootstrap/Col";
import { ToggleButtonHeight } from "@/common/constants";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

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

interface SoupProps {
  cardIdentifiersAndOptionNumbersBySource: {
    [source: string]: Array<[string, number]>;
  };
  selectImage: {
    (identifier: string): void;
  };
}

function CardsGroupedTogether(props: SoupProps) {
  /**
   * Render all images in `cardIdentifiersAndOptionNumbersBySource` in one block -
   * i.e. not separated by source.
   */

  return (
    <Row className="g-0" xxl={4} xl={4} lg={3} md={2} sm={2} xs={2}>
      {Object.entries(props.cardIdentifiersAndOptionNumbersBySource).map(
        ([key, value], sourceIndex) => (
          <>
            {value.flatMap(([identifier, index]) => (
              <Card // TODO: paginate or lazy-load these
                imageIdentifier={identifier}
                cardHeaderTitle={`Option ${index + 1}`}
                cardOnClick={() => props.selectImage(identifier)}
                key={`gridSelector-${identifier}`}
                noResultsFound={false}
              />
            ))}
          </>
        )
      )}
    </Row>
  );
}

function CardsFacetedBySource(props: SoupProps) {
  /**
   * Render all images in `cardIdentifiersAndOptionNumbersBySource` separated by source.
   * Allow users to toggle whether each source's cards are showed/hidden.
   */

  const dispatch = useDispatch();
  const sourcesVisible = useSelector(
    (state: RootState) => state.viewSettings.sourcesVisible
  );
  return (
    <>
      {Object.entries(props.cardIdentifiersAndOptionNumbersBySource).map(
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
                  data-testid={`${key}-collapse-header`}
                ></h4>
              </div>
            </div>

            <Collapse
              in={sourcesVisible[key] ?? true}
              data-testid={`${key}-collapse`}
            >
              <div>
                <hr key={`${key}-bottom-hr`} />
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
                      cardOnClick={() => props.selectImage(identifier)}
                      key={`gridSelector-${identifier}`}
                      noResultsFound={false}
                    />
                  ))}
                </Row>
              </div>
            </Collapse>
          </>
        )
      )}
    </>
  );
}

export function GridSelector(props: GridSelectorProps) {
  const dispatch = useDispatch();
  const cardDocuments = useSelector(
    (state: RootState) => state.cardDocuments.cardDocuments
  );
  const facetBySource = useSelector(
    (state: RootState) => state.viewSettings.facetBySource
  );
  const selectImage = useCallback(
    (identifier: string) => {
      props.onClick(identifier);
      props.handleClose();
    },
    [props]
  );

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
      size="lg"
      data-testid={props.testId}
    >
      <Modal.Header closeButton>
        <Modal.Title>Select Version</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={8} sm={6}>
            <Toggle
              onClick={() => dispatch(toggleFacetBySource())}
              on="Facet By Source"
              onClassName="flex-centre"
              off="Group All Cards Together"
              offClassName="flex-centre"
              onstyle="success"
              offstyle="info"
              width={100 + "%"}
              size="md"
              height={ToggleButtonHeight + "px"}
              active={facetBySource}
            />
          </Col>
          {facetBySource && (
            <Col md={4} sm={6}>
              <div className="d-grid gap-0">
                <Button onClick={() => dispatch(makeAllSourcesVisible())}>
                  <i
                    className="bi bi-arrows-expand"
                    style={{ paddingRight: 0.5 + "em" }}
                  />{" "}
                  Expand All
                </Button>
              </div>
            </Col>
          )}
        </Row>
        <br />
        {facetBySource ? (
          <CardsFacetedBySource
            cardIdentifiersAndOptionNumbersBySource={
              cardIdentifiersAndOptionNumbersBySource
            }
            selectImage={selectImage}
          />
        ) : (
          <CardsGroupedTogether
            cardIdentifiersAndOptionNumbersBySource={
              cardIdentifiersAndOptionNumbersBySource
            }
            selectImage={selectImage}
          />
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
