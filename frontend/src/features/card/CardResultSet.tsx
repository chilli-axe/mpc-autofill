import React, { PropsWithChildren, useMemo } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Stack from "react-bootstrap/Stack";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";
import RenderIfVisible from "react-render-if-visible";

import { ToggleButtonHeight } from "@/common/constants";
import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { AutofillCollapse } from "@/components/AutofillCollapse";
import { RightPaddedIcon } from "@/components/icon";
import { MemoizedEditorCard } from "@/features/card/Card";
import { selectCardDocumentsByIdentifier } from "@/store/slices/cardDocumentsSlice";
import { selectSourceNamesByKey } from "@/store/slices/sourceDocumentsSlice";
import {
  makeAllSourcesInvisible,
  makeAllSourcesVisible,
  selectAnySourcesCollapsed,
  selectFacetBySource,
  selectSourcesVisible,
  toggleFacetBySource,
  toggleSourceVisible,
} from "@/store/slices/viewSettingsSlice";

interface CardGridCardProps {
  identifier: string;
  index: number;
  selectImage?: {
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
      cardOnClick={selectImage && (() => selectImage(identifier))}
      key={`gridSelector-${identifier}`}
      noResultsFound={false}
      highlight={identifier === selectedImage}
    />
  );
}

function CardRow({ children }: PropsWithChildren) {
  return (
    <Row className="g-0 px-3" xxl={6} xl={6} lg={4} md={3} sm={2} xs={2}>
      {children}
    </Row>
  );
}

interface CardGridDisplayProps {
  cardIdentifiersAndOptionNumbersBySource: {
    [sourceKey: string]: Array<[string, number]>;
  };
  selectImage?: {
    (identifier: string): void;
  };
  selectedImage?: string;
  sourceNamesByKey: { [sourceKey: string]: string };
}

/**
 * Render all images in `cardIdentifiersAndOptionNumbersBySource` in one block -
 * i.e. not separated by source.
 */
function CardsGroupedTogether({
  cardIdentifiersAndOptionNumbersBySource,
  selectImage,
  selectedImage,
  sourceNamesByKey,
}: CardGridDisplayProps) {
  return (
    <CardRow>
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
                  key={`gridSelector-${identifier}-card`}
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
    </CardRow>
  );
}

/**
 * Render all images in `cardIdentifiersAndOptionNumbersBySource` separated by source.
 * Allow users to toggle whether each source's cards are showed/hidden.
 */
function CardsFacetedBySource({
  cardIdentifiersAndOptionNumbersBySource,
  selectImage,
  selectedImage,
  sourceNamesByKey,
}: CardGridDisplayProps) {
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
                cardIdentifiersAndOptionNumbers.length != 1 ? "s" : ""
              }`}
              sticky
            >
              <CardRow key={`${sourceKey}-row`}>
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
              </CardRow>
            </AutofillCollapse>
            <div className="py-2" />
          </>
        )
      )}
    </>
  );
}

export function CardResultSet({
  headerText,
  imageIdentifiers,
  selectedImage,
  handleClick,
}: {
  headerText: string;
  imageIdentifiers: Array<string>;
  selectedImage?: string;
  handleClick?: { (identifier: string): void };
}) {
  const dispatch = useAppDispatch();

  const facetBySource = useAppSelector(selectFacetBySource);
  const sourceNamesByKey = useAppSelector(selectSourceNamesByKey);
  const sourceKeys = Object.keys(sourceNamesByKey);
  const anySourcesCollapsed = useAppSelector(selectAnySourcesCollapsed);

  // TODO: memoizing on array prop? this doesn't work does it?
  const cardDocuments = useAppSelector((state) =>
    selectCardDocumentsByIdentifier(state, imageIdentifiers)
  );
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

  return (
    <>
      <div className="px-3 pb-3">
        <Row>
          <h4>{headerText}</h4>
          <Col md={8} sm={6}>
            <Stack direction="horizontal" gap={2}>
              <span className="me-auto">Show&nbsp;All&nbsp;Cards...</span>
              <Toggle
                onClick={() => dispatch(toggleFacetBySource())}
                on="Grouped By Source"
                onClassName="flex-centre"
                off="Grouped Together"
                offClassName="flex-centre"
                onstyle="success"
                offstyle="info"
                width={100 + "%"}
                size="md"
                height={ToggleButtonHeight + "px"}
                active={facetBySource}
              />
            </Stack>
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
          selectImage={handleClick}
          selectedImage={selectedImage}
          sourceNamesByKey={sourceNamesByKey}
        />
      ) : (
        <CardsGroupedTogether
          cardIdentifiersAndOptionNumbersBySource={
            cardIdentifiersAndOptionNumbersBySource
          }
          selectImage={handleClick}
          selectedImage={selectedImage}
          sourceNamesByKey={sourceNamesByKey}
        />
      )}
    </>
  );
}
