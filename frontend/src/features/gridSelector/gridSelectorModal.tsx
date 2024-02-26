/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
 * Card versions are faceted by source, and all cards for a source can be temporarily hidden.
 */

import React, {
  FormEvent,
  ReactElement,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Collapse from "react-bootstrap/Collapse";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Stack from "react-bootstrap/Stack";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";
import RenderIfVisible from "react-render-if-visible";

import { ToggleButtonHeight } from "@/common/constants";
import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { MemoizedEditorCard } from "@/features/card/card";
import { selectCardDocumentsByIdentifier } from "@/features/search/cardDocumentsSlice";
import { selectSourceNamesByKey } from "@/features/search/sourceDocumentsSlice";
import {
  makeAllSourcesInvisible,
  makeAllSourcesVisible,
  selectAnySourcesCollapsed,
  selectFacetBySource,
  selectJumpToVersionVisible,
  selectSourcesVisible,
  toggleFacetBySource,
  toggleJumpToVersionVisible,
  toggleSourceVisible,
} from "@/features/viewSettings/viewSettingsSlice";

interface CardGridCardProps {
  identifier: string;
  index: number;
  selectImage: {
    (identifier: string): void;
  };
  selectedImage?: string;
}

function CardGridCard({
  identifier,
  index,
  selectImage,
  selectedImage,
}: CardGridCardProps) {
  return (
    <MemoizedEditorCard
      imageIdentifier={identifier}
      cardHeaderTitle={`Option ${index + 1}`}
      cardOnClick={() => selectImage(identifier)}
      key={`gridSelector-${identifier}`}
      noResultsFound={false}
      highlight={identifier === selectedImage}
    />
  );
}

interface GridSelectorProps {
  title?: string;
  testId: string;
  imageIdentifiers: Array<string>;
  selectedImage?: string;
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
  selectedImage?: string;
  sourceNamesByKey: { [sourceKey: string]: string };
}

interface AutofillCollapseProps {
  expanded: boolean;
  onClick: () => void;
  zIndex: number;
  title: ReactElement | string;
  subtitle?: string;
  children: ReactElement;
  sticky?: boolean;
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
function AutofillCollapse({
  children,
  expanded,
  onClick,
  zIndex,
  title,
  subtitle,
  sticky = false,
}: AutofillCollapseProps) {
  return (
    <>
      <div
        className={sticky ? "sticky-top" : ""}
        onClick={onClick}
        style={{
          backgroundColor: "#4E5D6B",
          zIndex: zIndex + 100,
        }}
      >
        <hr className="mt-0" />
        <Stack direction="horizontal" gap={2} className="d-flex ps-4 pe-4">
          {title}
          {subtitle && (
            <h6 className="text-primary prevent-select">{subtitle}</h6>
          )}

          <h4
            className={`ms-auto bi bi-chevron-left rotate-${
              expanded ? "" : "neg"
            }90`}
            style={{ transition: "all 0.25s 0s" }}
          ></h4>
        </Stack>
        <hr className="mb-0" />
      </div>
      <div className="py-2" />
      <Collapse in={expanded}>{children}</Collapse>
    </>
  );
}

function CardsGroupedTogether({
  cardIdentifiersAndOptionNumbersBySource,
  selectImage,
  selectedImage,
  sourceNamesByKey,
}: CardGridDisplayProps) {
  /**
   * Render all images in `cardIdentifiersAndOptionNumbersBySource` in one block -
   * i.e. not separated by source.
   */

  return (
    <Row className="g-0 px-3" xxl={4} xl={4} lg={3} md={2} sm={2} xs={2}>
      {Object.entries(cardIdentifiersAndOptionNumbersBySource).map(
        ([key, value], sourceIndex) => (
          <>
            {value.flatMap(([identifier, index]) => (
              <RenderIfVisible
                key={`gridSelector-${identifier}-wrapper`}
                initialVisible={index < 20}
                visibleOffset={500}
                stayRendered
              >
                <CardGridCard
                  identifier={identifier}
                  index={index}
                  selectImage={selectImage}
                  selectedImage={selectedImage}
                />
              </RenderIfVisible>
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
  selectedImage,
  sourceNamesByKey,
}: CardGridDisplayProps) {
  /**
   * Render all images in `cardIdentifiersAndOptionNumbersBySource` separated by source.
   * Allow users to toggle whether each source's cards are showed/hidden.
   */

  //# region queries and hooks

  const dispatch = useAppDispatch();
  const sourcesVisible = useAppSelector(selectSourcesVisible);

  //# endregion

  return (
    <>
      {Object.entries(cardIdentifiersAndOptionNumbersBySource).map(
        ([sourceKey, cardIdentifiersAndOptionNumbers], sourceIndex) => (
          <>
            <AutofillCollapse
              key={sourceKey}
              expanded={sourcesVisible[sourceKey] ?? true}
              onClick={() => dispatch(toggleSourceVisible(sourceKey))}
              zIndex={sourceIndex}
              title={
                <h3
                  className="orpheus prevent-select"
                  style={{ fontStyle: "italic" }}
                >
                  {sourceNamesByKey[sourceKey]}
                </h3>
              }
              subtitle={`${cardIdentifiersAndOptionNumbers.length} version${
                cardIdentifiersAndOptionNumbers.length != 1 && "s"
              }`}
              sticky
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
                    <RenderIfVisible
                      key={`gridSelector-${identifier}-wrapper`}
                      initialVisible={optionNumber < 20}
                    >
                      <CardGridCard
                        identifier={identifier}
                        index={optionNumber}
                        selectImage={selectImage}
                        selectedImage={selectedImage}
                      />
                    </RenderIfVisible>
                  )
                )}
              </Row>
            </AutofillCollapse>
            <div className="py-2" />
          </>
        )
      )}
    </>
  );
}

export function GridSelectorModal({
  title = "Select Version",
  testId,
  imageIdentifiers,
  selectedImage,
  show,
  handleClose,
  onClick,
}: GridSelectorProps) {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const cardDocuments = useAppSelector((state) =>
    selectCardDocumentsByIdentifier(state, imageIdentifiers)
  );
  const facetBySource = useAppSelector(selectFacetBySource);
  const sourceNamesByKey = useAppSelector(selectSourceNamesByKey);
  const anySourcesCollapsed = useAppSelector(selectAnySourcesCollapsed);
  const jumpToVersionVisible = useAppSelector(selectJumpToVersionVisible);

  //# endregion

  //# region state

  const [optionNumber, setOptionNumber] = useState<number | undefined>(
    undefined
  );
  const [imageIdentifier, setImageIdentifier] = useState<string>("");
  const focusRef = useRef<HTMLInputElement>(null);

  //# endregion

  //# region callbacks

  const selectImage = useCallback(
    (identifier: string) => {
      onClick(identifier);
      handleClose();
    },
    [onClick, handleClose]
  );
  const handleSubmitJumpToVersionForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    selectImage(
      optionNumber ? imageIdentifiers[optionNumber - 1] : imageIdentifier
    );
  };

  //# endregion

  //# region computed constants

  const versionToJumpToIsValid =
    ((optionNumber ?? 0) > 0 &&
      (optionNumber ?? 0) < imageIdentifiers.length + 1) ||
    (imageIdentifier !== "" && imageIdentifiers.includes(imageIdentifier));
  const sourceKeys = Object.keys(sourceNamesByKey);
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

  //# endregion

  return (
    <Modal
      scrollable
      show={show}
      onEntered={() => {
        if (focusRef.current) {
          focusRef.current.focus();
        }
      }}
      onHide={handleClose}
      size="lg"
      data-testid={testId}
    >
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-grid p-0">
        <AutofillCollapse
          expanded={jumpToVersionVisible}
          onClick={() => dispatch(toggleJumpToVersionVisible())}
          zIndex={0}
          title={<h4>Jump to Version</h4>}
        >
          <Form
            className="px-3"
            id="jumpToVersionForm"
            onSubmit={handleSubmitJumpToVersionForm}
          >
            <Row className="g-0">
              <Col lg={3} md={5}>
                <Form.Label>
                  Specify Option Number, <b>or...</b>
                </Form.Label>
                <Form.Control
                  ref={focusRef}
                  type="number"
                  pattern="[0-9]*"
                  placeholder="1"
                  value={optionNumber}
                  onChange={(event) =>
                    setOptionNumber(
                      event.target.value
                        ? parseInt(event.target.value)
                        : undefined
                    )
                  }
                  disabled={Boolean(imageIdentifier)}
                />
              </Col>
              <Col lg={9} md={7}>
                <Form.Label>Specify ID</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={imageIdentifiers[0]}
                  value={imageIdentifier}
                  onChange={(event) => setImageIdentifier(event.target.value)}
                  disabled={Boolean(optionNumber)}
                />
              </Col>
            </Row>
            <div className="d-grid gap-0 pt-3">
              <Button
                variant="primary"
                form="jumpToVersionForm"
                type="submit"
                aria-label="jump-to-version-submit"
                disabled={!versionToJumpToIsValid}
              >
                Select This Version
              </Button>
            </div>
          </Form>
        </AutofillCollapse>
        <hr />
        <div className="px-3 pb-3">
          <Row>
            <h4>Browse Versions</h4>
            <Col md={8} sm={6}>
              <Toggle
                onClick={() => dispatch(toggleFacetBySource())}
                on="Group By Source"
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
        </div>
        {facetBySource ? (
          <CardsFacetedBySource
            cardIdentifiersAndOptionNumbersBySource={
              cardIdentifiersAndOptionNumbersBySource
            }
            selectImage={selectImage}
            selectedImage={selectedImage}
            sourceNamesByKey={sourceNamesByKey}
          />
        ) : (
          <CardsGroupedTogether
            cardIdentifiersAndOptionNumbersBySource={
              cardIdentifiersAndOptionNumbersBySource
            }
            selectImage={selectImage}
            selectedImage={selectedImage}
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
