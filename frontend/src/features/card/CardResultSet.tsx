import React, { PropsWithChildren, useMemo } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Stack from "react-bootstrap/Stack";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { AutofillCollapse } from "@/components/AutofillCollapse";
import { RightPaddedIcon } from "@/components/icon";
import { RenderIfVisible } from "@/components/RenderIfVisible";
import { MemoizedEditorCard } from "@/features/card/Card";
import { selectCardDocumentsByIdentifiers } from "@/store/slices/cardDocumentsSlice";
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
  imageIdentifiers: Array<string>;
  selectImage?: {
    (identifier: string): void;
  };
  selectedImage?: string;
  sourceNamesByKey: { [sourceKey: string]: string };
  favoriteIdentifiers?: Array<string>;
  originalIndexMap?: Map<string, number>;
}

/**
 * Render all images in a single grid.
 * Expects imageIdentifiers to already be sorted (favorites first) by the parent.
 * Option numbers reflect original indices (for consistency with external references).
 */
function CardsGroupedTogether({
  imageIdentifiers,
  selectImage,
  selectedImage,
  originalIndexMap,
}: CardGridDisplayProps) {
  return (
    <CardRow>
      {imageIdentifiers.map((identifier, visualIndex) => {
        const originalIndex = originalIndexMap?.get(identifier) ?? visualIndex;
        return (
          <RenderIfVisible
            key={`gridSelector-${identifier}-wrapper`}
            initialVisible={visualIndex < 20}
            visibleOffset={500}
            stayRendered
          >
            <CardGridCard
              identifier={identifier}
              index={originalIndex}
              selectImage={selectImage}
              selectedImage={selectedImage}
            />
          </RenderIfVisible>
        );
      })}
    </CardRow>
  );
}

const FAVORITES_SOURCE_KEY = "__favorites__";

interface Section {
  key: string;
  title: React.ReactNode;
  items: Array<[string, number]>;
}

/**
 * Render all images separated by source in collapsible sections.
 * Favorites are shown in a separate collapsible section before the source sections.
 * Option numbers reflect original indices (for consistency with external references).
 */
function CardsFacetedBySource({
  imageIdentifiers,
  selectImage,
  selectedImage,
  sourceNamesByKey,
  favoriteIdentifiers = [],
  originalIndexMap,
}: CardGridDisplayProps) {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const sourcesVisible = useAppSelector(selectSourcesVisible);

  //# endregion

  const favoriteSet = useMemo(
    () => new Set(favoriteIdentifiers),
    [favoriteIdentifiers]
  );

  // TODO: memoizing on array prop? this doesn't work does it?
  const cardDocuments = useAppSelector((state) =>
    selectCardDocumentsByIdentifiers(state, imageIdentifiers)
  );

  // Build unified sections array: favorites first, then sources
  const sections: Section[] = useMemo(() => {
    const favoriteItems: Array<[string, number]> = [];
    const bySource: { [sourceKey: string]: Array<[string, number]> } = {};

    imageIdentifiers.forEach((identifier, visualIndex) => {
      // Use original index if available, otherwise fall back to visual index
      const originalIndex = originalIndexMap?.get(identifier) ?? visualIndex;

      if (favoriteSet.has(identifier)) {
        favoriteItems.push([identifier, originalIndex]);
      }

      const cardDocument: CardDocument | null = cardDocuments[identifier];
      if (cardDocument != null) {
        if (
          !Object.prototype.hasOwnProperty.call(bySource, cardDocument.source)
        ) {
          bySource[cardDocument.source] = [];
        }
        bySource[cardDocument.source].push([identifier, originalIndex]);
      }
    });

    const result: Section[] = [];

    if (favoriteItems.length > 0) {
      result.push({
        key: FAVORITES_SOURCE_KEY,
        title: "Favorites",
        items: favoriteItems,
      });
    }

    for (const [sourceKey, items] of Object.entries(bySource)) {
      result.push({
        key: sourceKey,
        title: sourceNamesByKey[sourceKey] ?? sourceKey,
        items,
      });
    }

    return result;
  }, [
    cardDocuments,
    imageIdentifiers,
    favoriteSet,
    sourceNamesByKey,
    originalIndexMap,
  ]);

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <React.Fragment key={section.key}>
          <AutofillCollapse
            expanded={sourcesVisible[section.key] ?? true}
            onClick={() => dispatch(toggleSourceVisible(section.key))}
            zIndex={sectionIndex}
            title={
              <h3
                className="orpheus prevent-select"
                style={{ fontStyle: "italic" }}
              >
                {section.title}
              </h3>
            }
            subtitle={`${section.items.length} version${
              section.items.length != 1 ? "s" : ""
            }`}
            sticky
          >
            <CardRow>
              {section.items.map(([identifier, optionNumber]) => (
                <RenderIfVisible
                  key={`gridSelector-${identifier}-wrapper`}
                  initialVisible={optionNumber < 20}
                  stayRendered
                >
                  <CardGridCard
                    identifier={identifier}
                    index={optionNumber}
                    selectImage={selectImage}
                    selectedImage={selectedImage}
                  />
                </RenderIfVisible>
              ))}
            </CardRow>
          </AutofillCollapse>
          <div className="py-2" />
        </React.Fragment>
      ))}
    </>
  );
}

export function CardResultSet({
  headerText,
  imageIdentifiers,
  selectedImage,
  handleClick,
  favoriteIdentifiers = [],
  originalIndexMap,
}: {
  headerText: string;
  imageIdentifiers: Array<string>;
  selectedImage?: string;
  handleClick?: { (identifier: string): void };
  favoriteIdentifiers?: Array<string>;
  originalIndexMap?: Map<string, number>;
}) {
  const dispatch = useAppDispatch();

  const facetBySource = useAppSelector(selectFacetBySource);
  const sourceNamesByKey = useAppSelector(selectSourceNamesByKey);
  const anySourcesCollapsed = useAppSelector(selectAnySourcesCollapsed);
  const sourceKeys = [FAVORITES_SOURCE_KEY, ...Object.keys(sourceNamesByKey)];

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
          imageIdentifiers={imageIdentifiers}
          selectImage={handleClick}
          selectedImage={selectedImage}
          sourceNamesByKey={sourceNamesByKey}
          favoriteIdentifiers={favoriteIdentifiers}
          originalIndexMap={originalIndexMap}
        />
      ) : (
        <CardsGroupedTogether
          imageIdentifiers={imageIdentifiers}
          selectImage={handleClick}
          selectedImage={selectedImage}
          sourceNamesByKey={sourceNamesByKey}
          originalIndexMap={originalIndexMap}
        />
      )}
    </>
  );
}
