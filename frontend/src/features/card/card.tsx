/**
 * This component is a fundamental UI building block for displaying cards.
 * Displays a card's image, some extra information (its name, its source's name, and its DPI),
 * and has optional props for extending the component to include extra functionality.
 * If being used in a gallery, the previous and next images can be cached for visual smoothness.
 */

import Image from "next/image";
import React, { memo, ReactElement, useEffect, useState } from "react";
import BSCard from "react-bootstrap/Card";
import { useSelector } from "react-redux";
import styled from "styled-components";

import { RootState } from "@/app/store";
import { SearchQuery } from "@/common/types";
import { Spinner } from "@/features/ui/spinner";

const HiddenImage = styled(Image)`
  z-index: 0;
  opacity: 0;
`;

interface CardProps {
  /** The card image identifier to display. */
  imageIdentifier: string | undefined;
  /** If this `Card` is part of a gallery, use this prop to cache the previous image for visual smoothness. */
  previousImageIdentifier?: string | undefined;
  /** If this `Card` is part of a gallery, use this prop to cache the next image for visual smoothness. */
  nextImageIdentifier?: string | undefined;
  /** The string to display in the `Card` header. */
  cardHeaderTitle: string;
  /** An element (intended for use with a series of buttons) to include in the `Card` header.  */
  cardHeaderButtons?: ReactElement;
  /** An element (e.g. prev/next buttons) to display in the card footer. If not passed, no footer will be rendered. */
  cardFooter?: ReactElement;
  /** A callback function for when the displayed image is clicked. */
  imageOnClick?: React.MouseEventHandler<HTMLImageElement>;
  /** A callback function for when the `Card` (the HTML surrounding the image) is clicked. */
  cardOnClick?: React.MouseEventHandler<HTMLElement>;
  /** The `SearchQuery` specified when searching for this card. */
  searchQuery?: SearchQuery | undefined;
  /** Whether no search results were found when searching for `searchQuery` under the configured search settings. */
  noResultsFound: boolean;
}

export function Card({
  imageIdentifier,
  previousImageIdentifier,
  nextImageIdentifier,
  cardHeaderTitle,
  cardHeaderButtons,
  cardFooter,
  imageOnClick,
  cardOnClick,
  searchQuery,
  noResultsFound,
}: CardProps) {
  // ensure that the small thumbnail fades in each time the selected image changes
  const [smallThumbnailLoading, setSmallThumbnailLoading] = useState(true);
  useEffect(() => setSmallThumbnailLoading(true), [imageIdentifier]);

  const maybeCardDocument = useSelector((state: RootState) =>
    imageIdentifier != null
      ? state.cardDocuments.cardDocuments[imageIdentifier]
      : undefined
  );

  const maybePreviousCardDocument = useSelector((state: RootState) =>
    previousImageIdentifier != null
      ? state.cardDocuments.cardDocuments[previousImageIdentifier]
      : undefined
  );
  const maybeNextCardDocument = useSelector((state: RootState) =>
    nextImageIdentifier != null
      ? state.cardDocuments.cardDocuments[nextImageIdentifier]
      : undefined
  );

  const cardImageElements =
    maybeCardDocument != null ? (
      <>
        {smallThumbnailLoading && <Spinner />}

        <Image
          className="card-img card-img-fade-in"
          loading="lazy"
          style={{ zIndex: 1, opacity: smallThumbnailLoading ? 0 : 1 }}
          src={maybeCardDocument.small_thumbnail_url}
          onLoad={() => setSmallThumbnailLoading(false)}
          onClick={imageOnClick}
          // onError={{thumbnail_404(this)}} // TODO
          alt={maybeCardDocument.name}
          fill={true}
        />
        {previousImageIdentifier !== imageIdentifier &&
          maybePreviousCardDocument !== undefined && (
            <HiddenImage
              className="card-img"
              loading="lazy"
              src={maybePreviousCardDocument.small_thumbnail_url}
              // onError={{thumbnail_404(this)}}
              alt={maybePreviousCardDocument.name}
              fill={true}
            />
          )}
        {nextImageIdentifier !== imageIdentifier &&
          maybeNextCardDocument !== undefined && (
            <HiddenImage
              className="card-img"
              loading="lazy"
              src={maybeNextCardDocument.small_thumbnail_url}
              // onError={{thumbnail_404(this)}}
              alt={maybeNextCardDocument.name}
              fill={true}
            />
          )}
      </>
    ) : noResultsFound ? (
      <Image
        className="card-img card-img-fade-in"
        loading="lazy"
        style={{ zIndex: 1 }}
        src="/blank.png"
        alt="Card not found"
        fill={true}
      />
    ) : (
      <Spinner />
    );
  return (
    <BSCard className="mpccard mpccard-hover" onClick={cardOnClick}>
      <BSCard.Header className="pb-0 text-center">
        <p className="mpccard-slot">{cardHeaderTitle}</p>
        {cardHeaderButtons}
      </BSCard.Header>
      <div>
        <div
          className="rounded-lg shadow-lg ratio ratio-7x5"
          style={{ zIndex: 0 }}
        >
          {cardImageElements}
        </div>
        <BSCard.Body className="mb-0 text-center">
          <BSCard.Subtitle className="mpccard-name">
            {maybeCardDocument != null && maybeCardDocument.name}
            {maybeCardDocument == null &&
              searchQuery != undefined &&
              searchQuery.query}
          </BSCard.Subtitle>
          <div className="mpccard-spacing">
            <BSCard.Text className="mpccard-source">
              {maybeCardDocument != null &&
                `${maybeCardDocument.source_verbose} [${maybeCardDocument.dpi} DPI]`}
              {maybeCardDocument == null &&
                searchQuery != undefined &&
                "Your search query"}
            </BSCard.Text>
          </div>
        </BSCard.Body>
      </div>
      {cardFooter != null && (
        <BSCard.Footer
          className="padding-top"
          style={{ paddingTop: 50 + "px" }}
        >
          {cardFooter}
        </BSCard.Footer>
      )}
    </BSCard>
  );
}

export const MemoizedCard = memo(Card);
