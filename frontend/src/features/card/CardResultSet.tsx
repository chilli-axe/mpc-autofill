import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import Row from "react-bootstrap/Row";

import {
  FavouritesSourceKey,
  Unknown,
  UnknownSourceKey,
} from "@/common/constants";
import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { AutofillCollapse } from "@/components/AutofillCollapse";
import { RenderIfVisible } from "@/components/RenderIfVisible";
import { MemoizedEditorCard } from "@/features/card/Card";
import { selectCardDocumentsByIdentifiers } from "@/store/slices/cardDocumentsSlice";
import { selectSourceNamesByKey } from "@/store/slices/sourceDocumentsSlice";
import {
  selectCompressed,
  selectFacetBy,
  selectFacetsVisible,
  setFacetInvisible,
  setFacetKeys,
  setFacetVisible,
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
    <Row className="g-0 p-1" xxl={6} xl={6} lg={4} md={3} sm={2} xs={2}>
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
  facetNamesByKey: { [sourceKey: string]: string };
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
            defaultHeight={compressed ? 197 : 300}
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
function FacetedCards({
  imageIdentifiers,
  selectImage,
  selectedImage,
  facetNamesByKey,
  favoriteIdentifiers = [],
  originalIndexMap,
  compressed,
  facetByCallable,
}: CardGridDisplayProps & {
  facetByCallable: (card: CardDocument) => string | undefined;
}) {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const facetsVisible = useAppSelector(selectFacetsVisible);

  //# endregion

  const favoriteSet = useMemo(
    () => new Set(favoriteIdentifiers),
    [favoriteIdentifiers]
  );

  // TODO: memoizing on array prop? this doesn't work does it?
  const cardDocuments = useAppSelector((state) =>
    selectCardDocumentsByIdentifiers(state, imageIdentifiers)
  );

  // Build unified sections array: favorites first, then facets
  const sections: Section[] = useMemo(() => {
    const favoriteItems: Array<[string, number]> = [];
    const byFacet: { [sourceKey: string]: Array<[string, number]> } = {};
    const unknownItems: Array<[string, number]> = [];

    imageIdentifiers.forEach((identifier, visualIndex) => {
      // Use original index if available, otherwise fall back to visual index
      const originalIndex = originalIndexMap?.get(identifier) ?? visualIndex;

      if (favoriteSet.has(identifier)) {
        favoriteItems.push([identifier, originalIndex]);
      }

      const cardDocument: CardDocument | null = cardDocuments[identifier];
      if (cardDocument != null) {
        const facet = facetByCallable(cardDocument);
        if (facet === undefined) {
          unknownItems.push([identifier, originalIndex]);
        } else {
          if (!Object.prototype.hasOwnProperty.call(byFacet, facet)) {
            byFacet[facet] = [];
          }
          byFacet[facet].push([identifier, originalIndex]);
        }
      }
    });

    const result: Section[] = [];

    if (favoriteItems.length > 0) {
      result.push({
        key: FavouritesSourceKey,
        title: "Favourites",
        items: favoriteItems,
      });
    }

    for (const [sourceKey, items] of Object.entries(byFacet)) {
      result.push({
        key: sourceKey,
        title: facetNamesByKey[sourceKey] ?? sourceKey,
        items,
      });
    }

    if (unknownItems.length > 0) {
      result.push({
        key: UnknownSourceKey,
        title: Unknown,
        items: unknownItems,
      });
    }

    return result;
  }, [
    cardDocuments,
    imageIdentifiers,
    favoriteSet,
    facetNamesByKey,
    originalIndexMap,
    facetByCallable,
  ]);

  useEffect(() => {
    dispatch(setFacetKeys(sections.map((s) => s.key)));
  }, [sections]);

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <React.Fragment key={section.key}>
          <AutofillCollapse
            expanded={facetsVisible[section.key] ?? true}
            onClick={() =>
              dispatch(
                facetsVisible[section.key] ?? true
                  ? setFacetInvisible(section.key)
                  : setFacetVisible(section.key)
              )
            }
            zIndex={sections.length - sectionIndex}
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
}: {
  imageIdentifiers: Array<string>;
  selectedImage?: string;
  handleClick?: { (identifier: string): void };
  favoriteIdentifiers?: Array<string>;
  originalIndexMap?: Map<string, number>;
}) {
  const facetBy = useAppSelector(selectFacetBy);
  const compressed = useAppSelector(selectCompressed);
  const facetNamesByKey = useAppSelector(selectSourceNamesByKey); // TODO

  const facetByCallable = useCallback(
    (card: CardDocument): string | undefined => {
      if (facetBy === "Source") return card.source;
      if (facetBy === "Printing") return card.canonicalCard?.expansionName;
      if (facetBy === "Artist") return card.canonicalArtist?.name;
      return "";
    },
    [facetBy]
  );

  if (facetBy === "Source" || facetBy === "Printing" || facetBy === "Artist") {
    return (
      <FacetedCards
        imageIdentifiers={imageIdentifiers}
        selectImage={handleClick}
        selectedImage={selectedImage}
        facetNamesByKey={facetNamesByKey}
        favoriteIdentifiers={favoriteIdentifiers}
        originalIndexMap={originalIndexMap}
        compressed={compressed}
        facetByCallable={facetByCallable}
      />
    );
  }

  return (
    <CardsGroupedTogether
      imageIdentifiers={imageIdentifiers}
      selectImage={handleClick}
      selectedImage={selectedImage}
      facetNamesByKey={facetNamesByKey}
      originalIndexMap={originalIndexMap}
      compressed={compressed}
    />
  );
}
