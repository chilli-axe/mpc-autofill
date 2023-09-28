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

import { ToggleButtonHeight } from "@/common/constants";
import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { MemoizedEditorCard } from "@/features/card/card";
import { selectCardDocumentsByIdentifier } from "@/features/search/cardDocumentsSlice";
import { selectSourceNamesByKey } from "@/features/search/sourceDocumentsSlice";
import { RightPaddedIcon } from "@/features/ui/styledComponents";
import {
  makeAllSourcesInvisible,
  makeAllSourcesVisible,
  selectAnySourcesCollapsed,
  selectFacetBySource,
  selectSourcesVisible,
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
  sourceNamesByKey: { [sourceKey: string]: string };
}

function CardsGroupedTogether({
  cardIdentifiersAndOptionNumbersBySource,
  selectImage,
  sourceNamesByKey,
}: CardGridDisplayProps) {
  /**
   * Render all images in `cardIdentifiersAndOptionNumbersBySource` in one block -
   * i.e. not separated by source.
   */

  return (
    <Row className="g-0 p-3" xxl={4} xl={4} lg={3} md={2} sm={2} xs={2}>
      {Object.entries(cardIdentifiersAndOptionNumbersBySource).map(
        ([key, value], sourceIndex) => (
          <>
            {value.flatMap(([identifier, index]) => (
              <MemoizedEditorCard // TODO: paginate or lazy-load these
                imageIdentifier={identifier}
                cardHeaderTitle={`Option ${index + 1}`}
                cardOnClick={() => selectImage(identifier)}
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

function CardsFacetedBySource({
  cardIdentifiersAndOptionNumbersBySource,
  selectImage,
  sourceNamesByKey,
}: CardGridDisplayProps) {
  /**
   * Render all images in `cardIdentifiersAndOptionNumbersBySource` separated by source.
   * Allow users to toggle whether each source's cards are showed/hidden.
   */

  const dispatch = useAppDispatch();
  const sourcesVisible = useAppSelector(selectSourcesVisible);
  return (
    <>
      {Object.entries(cardIdentifiersAndOptionNumbersBySource).map(
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
              <hr className="mt-0" key={`${sourceKey}-top-hr`} />
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
                  {sourceNamesByKey[sourceKey]}
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
              <hr className="mb-0" key={`${sourceKey}-bottom-hr`} />
            </div>
            <div className="py-2" />
            <Collapse
              in={sourcesVisible[sourceKey] ?? true}
              data-testid={`${sourceKey}-collapse`}
            >
              <Row
                className="g-0 px-3"
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
                    <MemoizedEditorCard
                      imageIdentifier={identifier}
                      cardHeaderTitle={`Option ${optionNumber + 1}`}
                      cardOnClick={() => selectImage(identifier)}
                      key={`gridSelector-${identifier}`}
                      noResultsFound={false}
                    />
                  )
                )}
              </Row>
            </Collapse>
            <div className="py-2" />
          </>
        )
      )}
    </>
  );
}

export function GridSelectorModal({
  testId,
  imageIdentifiers,
  show,
  handleClose,
  onClick,
}: GridSelectorProps) {
  const dispatch = useAppDispatch();
  const cardDocuments = useAppSelector((state) =>
    selectCardDocumentsByIdentifier(state, imageIdentifiers)
  );
  const facetBySource = useAppSelector(selectFacetBySource);
  const selectImage = useCallback(
    (identifier: string) => {
      onClick(identifier);
      handleClose();
    },
    [onClick, handleClose]
  );

  const sourceNamesByKey = useAppSelector(selectSourceNamesByKey);
  const sourceKeys = Object.keys(sourceNamesByKey);
  const anySourcesCollapsed = useAppSelector(selectAnySourcesCollapsed);
  const cardIdentifiersAndOptionNumbersBySource = useMemo(
    () =>
      imageIdentifiers.reduce(
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
    [cardDocuments, imageIdentifiers]
  );

  // TODO: paginate or lazy-load these cards. this is quite slow when you have hundreds of images.

  return (
    <Modal
      scrollable
      show={show}
      onHide={handleClose}
      size="lg"
      data-testid={testId}
    >
      <Modal.Header closeButton>
        <Modal.Title>Select Version</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-grid p-0">
        <Row className="p-3" style={{ width: 100 + "%" }}>
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
              <div className="d-grid g-0">
                <Button
                  onClick={() =>
                    dispatch(
                      anySourcesCollapsed
                        ? makeAllSourcesVisible()
                        : makeAllSourcesInvisible(sourceKeys)
                    )
                  }
                >
                  <RightPaddedIcon
                    bootstrapIconName={`arrows-${
                      anySourcesCollapsed ? "expand" : "collapse"
                    }`}
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
            sourceNamesByKey={sourceNamesByKey}
          />
        ) : (
          <CardsGroupedTogether
            cardIdentifiersAndOptionNumbersBySource={
              cardIdentifiersAndOptionNumbersBySource
            }
            selectImage={selectImage}
            sourceNamesByKey={sourceNamesByKey}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
