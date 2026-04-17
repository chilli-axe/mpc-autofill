import React, { PropsWithChildren, useMemo } from "react";
import Row from "react-bootstrap/Row";

import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { AutofillCollapse } from "@/components/AutofillCollapse";
import { RenderIfVisible } from "@/components/RenderIfVisible";
import { MemoizedEditorCard } from "@/features/card/Card";
import { selectCardDocumentsByIdentifiers } from "@/store/slices/cardDocumentsSlice";
import { selectSourceNamesByKey } from "@/store/slices/sourceDocumentsSlice";
import {
  selectFacetBySource,
  selectSourcesVisible,
  toggleSourceVisible,
} from "@/store/slices/viewSettingsSlice";

interface CardGridCardProps {
  identifier: string;
  index: number;
  selectImage?: {
    (identifier: string): void;
  };
  selectedImage?: string;
  compressed?: boolean;
}

function CardGridCard({
  identifier,
  index,
  selectImage,
  selectedImage,
  compressed,
}: CardGridCardProps) {
  return (
    <MemoizedEditorCard
      imageIdentifier={identifier}
      cardHeaderTitle={`Option ${index + 1}`}
      cardOnClick={selectImage && (() => selectImage(identifier))}
      key={`gridSelector-${identifier}`}
      noResultsFound={false}
      highlight={identifier === selectedImage}
      compressed={compressed}
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
  compressed?: boolean;
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
  compressed,
}: CardGridDisplayProps) {
  return (
    <CardRow>
      {imageIdentifiers.map((identifier, visualIndex) => {
        const originalIndex = originalIndexMap?.get(identifier) ?? visualIndex;
        return (
          <RenderIfVisible
            key={`gridSelector-${identifier}-wrapper-${
              compressed ? "compressed" : "relaxed"
            }`}
            initialVisible={visualIndex < 20}
            visibleOffset={500}
            stayRendered
          >
            <CardGridCard
              identifier={identifier}
              index={originalIndex}
              selectImage={selectImage}
              selectedImage={selectedImage}
              compressed={compressed}
            />
          </RenderIfVisible>
        );
      })}
    </CardRow>
  );
}

export const FAVORITES_SOURCE_KEY = "__favorites__";

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
  compressed,
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
        title: "Favourites",
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
                  key={`gridSelector-${identifier}-wrapper-${
                    compressed ? "compressed" : "relaxed"
                  }`}
                  initialVisible={optionNumber < 20}
                  stayRendered
                >
                  <CardGridCard
                    identifier={identifier}
                    index={optionNumber}
                    selectImage={selectImage}
                    selectedImage={selectedImage}
                    compressed={compressed}
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
  imageIdentifiers,
  selectedImage,
  handleClick,
  favoriteIdentifiers = [],
  originalIndexMap,
  compressed,
}: {
  imageIdentifiers: Array<string>;
  selectedImage?: string;
  handleClick?: { (identifier: string): void };
  favoriteIdentifiers?: Array<string>;
  originalIndexMap?: Map<string, number>;
  compressed?: boolean;
}) {
  const facetBySource = useAppSelector(selectFacetBySource);
  const sourceNamesByKey = useAppSelector(selectSourceNamesByKey);

  return (
    <>
      {facetBySource ? (
        <CardsFacetedBySource
          imageIdentifiers={imageIdentifiers}
          selectImage={handleClick}
          selectedImage={selectedImage}
          sourceNamesByKey={sourceNamesByKey}
          favoriteIdentifiers={favoriteIdentifiers}
          originalIndexMap={originalIndexMap}
          compressed={compressed}
        />
      ) : (
        <CardsGroupedTogether
          imageIdentifiers={imageIdentifiers}
          selectImage={handleClick}
          selectedImage={selectedImage}
          sourceNamesByKey={sourceNamesByKey}
          originalIndexMap={originalIndexMap}
          compressed={compressed}
        />
      )}
    </>
  );
}
