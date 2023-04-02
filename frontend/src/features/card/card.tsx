import React, { useState, ReactElement, useEffect, memo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";

import BSCard from "react-bootstrap/Card";
import { SearchQuery } from "@/common/types";
import Image from "next/image";

interface CardProps {
  imageIdentifier: string | undefined;
  previousImageIdentifier?: string | undefined;
  nextImageIdentifier?: string | undefined;
  cardHeaderTitle: string;
  cardHeaderButtons?: ReactElement;
  cardFooter?: ReactElement;
  imageOnClick?: React.MouseEventHandler<HTMLImageElement>;
  cardOnClick?: React.MouseEventHandler<HTMLElement>;
  searchQuery?: SearchQuery | undefined;
  noResultsFound: boolean;
}

export function Card(props: CardProps) {
  // ensure that the small thumbnail fades in each time the selected image changes
  const [smallThumbnailLoading, setSmallThumbnailLoading] = useState(true);
  useEffect(() => setSmallThumbnailLoading(true), [props.imageIdentifier]);

  const maybeCardDocument = useSelector((state: RootState) =>
    props.imageIdentifier != null
      ? state.cardDocuments.cardDocuments[props.imageIdentifier]
      : undefined
  );

  const maybePreviousCardDocument = useSelector((state: RootState) =>
    props.previousImageIdentifier != null
      ? state.cardDocuments.cardDocuments[props.previousImageIdentifier]
      : undefined
  );
  const maybeNextCardDocument = useSelector((state: RootState) =>
    props.nextImageIdentifier != null
      ? state.cardDocuments.cardDocuments[props.nextImageIdentifier]
      : undefined
  );
  // const searchResultsIdle = // TODO: replace the magic string here with a constant
  //   useSelector((state: RootState) => state.searchResults.status) === "idle";

  const cardImageElements =
    maybeCardDocument != null ? (
      <>
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ opacity: smallThumbnailLoading ? 1 : 0 }}
        >
          <div
            className="spinner-border"
            style={{ width: 4 + "em", height: 4 + "em" }}
            role="status"
          >
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>

        <Image
          className="card-img card-img-fade-in"
          loading="lazy"
          style={{ zIndex: 1, opacity: smallThumbnailLoading ? 0 : 1 }}
          src={maybeCardDocument.small_thumbnail_url}
          onLoad={() => setSmallThumbnailLoading(false)}
          onClick={props.imageOnClick}
          // onError={{thumbnail_404(this)}}
          alt={maybeCardDocument.name}
          fill={true}
        />
        {props.previousImageIdentifier !== props.imageIdentifier &&
          maybePreviousCardDocument !== undefined && (
            <Image
              className="card-img"
              loading="lazy"
              style={{ zIndex: 0, opacity: 0 }}
              src={maybePreviousCardDocument.small_thumbnail_url}
              // onError={{thumbnail_404(this)}}
              alt={maybePreviousCardDocument.name}
              fill={true}
            />
          )}
        {props.nextImageIdentifier !== props.imageIdentifier &&
          maybeNextCardDocument !== undefined && (
            <Image
              className="card-img"
              loading="lazy"
              style={{ zIndex: 0, opacity: 0 }}
              src={maybeNextCardDocument.small_thumbnail_url}
              // onError={{thumbnail_404(this)}}
              alt={maybeNextCardDocument.name}
              fill={true}
            />
          )}
      </>
    ) : props.noResultsFound ? (
      <Image
        className="card-img card-img-fade-in"
        loading="lazy"
        style={{ zIndex: 1 }}
        src="/blank.png"
        alt="Card not found"
        fill={true}
      />
    ) : (
      <div className="d-flex justify-content-center align-items-center">
        <div
          className="spinner-border"
          style={{ width: 4 + "em", height: 4 + "em" }}
          role="status"
        >
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  return (
    <BSCard className="mpccard mpccard-hover" onClick={props.cardOnClick}>
      <BSCard.Header className="pb-0 text-center">
        <p className="mpccard-slot">{props.cardHeaderTitle}</p>
        {props.cardHeaderButtons}
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
              props.searchQuery != undefined &&
              props.searchQuery.query}
          </BSCard.Subtitle>
          <div className="mpccard-spacing">
            <BSCard.Text className="mpccard-source">
              {maybeCardDocument != null &&
                `${maybeCardDocument.source_verbose} [${maybeCardDocument.dpi} DPI]`}
              {maybeCardDocument == null &&
                props.searchQuery != undefined &&
                "Your search query"}
            </BSCard.Text>
          </div>
        </BSCard.Body>
      </div>
      {props.cardFooter != null && (
        <BSCard.Footer
          className="padding-top"
          style={{ paddingTop: 50 + "px" }}
        >
          {props.cardFooter}
        </BSCard.Footer>
      )}
    </BSCard>
  );
}

export const MemoizedCard = memo(Card);
