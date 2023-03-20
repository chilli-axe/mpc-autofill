import React, { useState, ReactElement, useEffect, memo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";

import BSCard from "react-bootstrap/Card";
import { SearchQuery } from "../../common/types";

interface CardProps {
  imageIdentifier?: string;
  previousImageIdentifier?: string;
  nextImageIdentifier?: string;
  cardHeaderTitle: string;
  cardHeaderButtons?: ReactElement;
  cardFooter?: ReactElement;
  imageOnClick?: React.MouseEventHandler<HTMLImageElement>;
  cardOnClick?: React.MouseEventHandler<HTMLElement>;
  searchQuery?: SearchQuery;
  noResultsFound: boolean;
}

export function Card(props: CardProps) {
  // ensure that the small thumbnail fades in each time the selected image changes
  const [smallThumbnailLoading, setSmallThumbnailLoading] = useState(true);
  useEffect(() => setSmallThumbnailLoading(true), [props.imageIdentifier]);

  // const [nameEditable, setNameEditable] = useState(false);

  // we have to store these in variables for typescript to recognise that
  // the below ternary operators avoid indexing with `undefined`
  const imageIdentifier = props.imageIdentifier;
  const previousImageIdentifier = props.previousImageIdentifier;
  const nextImageIdentifier = props.nextImageIdentifier;

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

        <img
          className="card-img card-img-fade-in"
          loading="lazy"
          style={{ zIndex: 1, opacity: smallThumbnailLoading ? 0 : 1 }}
          src={maybeCardDocument.small_thumbnail_url}
          onLoad={() => setSmallThumbnailLoading(false)}
          onClick={props.imageOnClick}
          // onClick={handleShow}  // TODO: pass onclick function in props
          // onError={{thumbnail_404(this)}}
          alt={maybeCardDocument.name}
        />
        {props.previousImageIdentifier !== props.imageIdentifier &&
          maybePreviousCardDocument !== undefined && (
            <img
              className="card-img"
              loading="lazy"
              style={{ zIndex: 0, opacity: 0 }}
              src={maybePreviousCardDocument.small_thumbnail_url}
              // onError={{thumbnail_404(this)}}
              alt={maybePreviousCardDocument.name}
            />
          )}
        {props.nextImageIdentifier !== props.imageIdentifier &&
          maybeNextCardDocument !== undefined && (
            <img
              className="card-img"
              loading="lazy"
              style={{ zIndex: 0, opacity: 0 }}
              src={maybeNextCardDocument.small_thumbnail_url}
              // onError={{thumbnail_404(this)}}
              alt={maybeNextCardDocument.name}
            />
          )}
      </>
    ) : props.noResultsFound ? (
      <img
        className="card-img card-img-fade-in"
        loading="lazy"
        style={{ zIndex: 1 }}
        src={"/static/cardpicker/blank.png"} // TODO: double check this is the correct way to serve this image
        alt="Card not found"
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
          <BSCard.Subtitle
            className="mpccard-name"
            // contentEditable="true"  // TODO: sort out a better way of managing text input
            // spellCheck="false"
            // onFocus="Library.review.selectElementContents(this)"
          >
            {maybeCardDocument != null && maybeCardDocument.name}
            {maybeCardDocument == null &&
              props.searchQuery != null &&
              props.searchQuery.query}
          </BSCard.Subtitle>
          <div className="mpccard-spacing">
            <BSCard.Text className="mpccard-source">
              {maybeCardDocument != null &&
                `${maybeCardDocument.source_verbose} [${maybeCardDocument.dpi} DPI]`}
              {maybeCardDocument == null &&
                props.searchQuery != null &&
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
