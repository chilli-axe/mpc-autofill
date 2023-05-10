/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
 * Card versions are faceted by source, and all cards for a source can be temporarily hidden.
 */

import React, { useCallback, useMemo } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Collapse from "react-bootstrap/Collapse";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Stack from "react-bootstrap/Stack";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "@/app/store";
import { ToggleButtonHeight } from "@/common/constants";
import { CardDocument } from "@/common/types";
import { MemoizedCard } from "@/features/card/card";
import {
  makeAllSourcesInvisible,
  makeAllSourcesVisible,
  toggleFacetBySource,
  toggleSourceVisible,
} from "@/features/viewSettings/viewSettingsSlice";

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

interface CardGridDisplayProps {
  cardIdentifiersAndOptionNumbersBySource: {
    [sourceKey: string]: Array<[string, number]>;
  };
  selectImage: {
    (identifier: string): void;
  };
  sourceKeyToName: { [sourceKey: string]: string };
}

function CardsGroupedTogether(props: CardGridDisplayProps) {
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
              <MemoizedCard // TODO: paginate or lazy-load these
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

function CardsFacetedBySource(props: CardGridDisplayProps) {
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
        ([sourceKey, cardIdentifiersAndOptionNumbers], sourceIndex) => (
          <>
            <div
              className="sticky-top"
              onClick={() => dispatch(toggleSourceVisible(sourceKey))}
              style={{
                backgroundColor: "#4E5D6B",
                zIndex: sourceIndex + 100,
              }}
              key={`${sourceKey}-header`}
            >
              <hr key={`${sourceKey}-top-hr`} />
              <Stack
                direction="horizontal"
                gap={2}
                key={`${sourceKey}-header-inner`}
                className="d-flex ps-2 pe-2"
              >
                <h3
                  className="orpheus prevent-select"
                  key={`${sourceKey}-header-title`}
                  style={{ fontStyle: "italic" }}
                >
                  {props.sourceKeyToName[sourceKey]}
                </h3>
                <h6 className="text-primary prevent-select">
                  {cardIdentifiersAndOptionNumbers.length} version
                  {cardIdentifiersAndOptionNumbers.length != 1 && "s"}
                </h6>
                <h4
                  key={`${sourceKey}-arrow`}
                  className={`ms-auto bi bi-chevron-left rotate-${
                    sourcesVisible[sourceKey] ?? true ? "" : "neg"
                  }90`}
                  style={{ transition: "all 0.25s 0s" }}
                  data-testid={`${sourceKey}-collapse-header`}
                ></h4>
              </Stack>
            </div>

            <Collapse
              in={sourcesVisible[sourceKey] ?? true}
              data-testid={`${sourceKey}-collapse`}
            >
              <div>
                <hr key={`${sourceKey}-bottom-hr`} />
                <Row
                  className="g-0"
                  xxl={4}
                  xl={4}
                  lg={3}
                  md={2}
                  sm={2}
                  xs={2}
                  key={`${sourceKey}-row`}
                >
                  {cardIdentifiersAndOptionNumbers.map(
                    ([identifier, optionNumber]) => (
                      <MemoizedCard
                        imageIdentifier={identifier}
                        cardHeaderTitle={`Option ${optionNumber + 1}`}
                        cardOnClick={() => props.selectImage(identifier)}
                        key={`gridSelector-${identifier}`}
                        noResultsFound={false}
                      />
                    )
                  )}
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

  // TODO: move these selectors into a common area where they can be reused
  const sourceKeyToName = useSelector((state: RootState) =>
    Object.fromEntries(
      Object.keys(state.sourceDocuments.sourceDocuments ?? {}).map((pk) => [
        state.sourceDocuments.sourceDocuments[pk].key,
        state.sourceDocuments.sourceDocuments[pk].name,
      ])
    )
  );
  const sourceKeys = Object.keys(sourceKeyToName);
  const anySourcesCollapsed = useSelector((state: RootState) =>
    Object.values(state.viewSettings.sourcesVisible ?? {}).includes(false)
  );
  const cardIdentifiersAndOptionNumbersBySource = useMemo(
    () =>
      props.imageIdentifiers.reduce(
        (
          accumulator: { [sourceKey: string]: Array<[string, number]> },
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
                <Button
                  onClick={() =>
                    dispatch(
                      anySourcesCollapsed
                        ? // ? makeAllSourcesInvisible(sourceKeys)
                          makeAllSourcesVisible()
                        : makeAllSourcesInvisible(sourceKeys)
                    )
                  }
                >
                  <i
                    className={`bi bi-arrows-${
                      anySourcesCollapsed ? "expand" : "collapse"
                    }`}
                    style={{ paddingRight: 0.5 + "em" }}
                  />{" "}
                  {anySourcesCollapsed ? "Expand" : "Collapse"} All
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
            sourceKeyToName={sourceKeyToName}
          />
        ) : (
          <CardsGroupedTogether
            cardIdentifiersAndOptionNumbersBySource={
              cardIdentifiersAndOptionNumbersBySource
            }
            selectImage={selectImage}
            sourceKeyToName={sourceKeyToName}
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
