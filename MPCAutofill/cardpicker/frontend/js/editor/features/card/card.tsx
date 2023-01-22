import React, { useState, ReactElement } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";

import BSCard from "react-bootstrap/Card";

interface CardProps {
  imageIdentifier?: string;
  previousImageIdentifier?: string;
  nextImageIdentifier?: string;
  cardHeaderTitle: string;
  cardHeaderButtons?: ReactElement;
  cardFooter?: ReactElement;
  imageOnClick?: React.MouseEventHandler<HTMLImageElement>;
  cardOnClick?: React.MouseEventHandler<HTMLElement>;
  noResultsFound: boolean;
}

export function Card(props: CardProps) {
  const [smallThumbnailLoading, setSmallThumbnailLoading] = useState(true);

  const [nameEditable, setNameEditable] = useState(false);

  const imageIdentifier: string = props.imageIdentifier;
  const maybeCardDocument = useSelector(
    (state: RootState) => state.cardDocuments.cardDocuments[imageIdentifier]
  );
  const maybePreviousCardDocument = useSelector(
    (state: RootState) =>
      state.cardDocuments.cardDocuments[props.previousImageIdentifier]
  );
  const maybeNextCardDocument = useSelector(
    (state: RootState) =>
      state.cardDocuments.cardDocuments[props.nextImageIdentifier]
  );
  const searchResultsIdle = // TODO: replace the magic string here with a constant
    useSelector((state: RootState) => state.searchResults.status) == "idle";

  const cardImageElements =
    maybeCardDocument !== undefined ? (
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
        {props.previousImageIdentifier !== imageIdentifier &&
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
        {props.nextImageIdentifier !== imageIdentifier &&
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
            {maybeCardDocument !== undefined && maybeCardDocument.name}
          </BSCard.Subtitle>
          <div className="mpccard-spacing">
            <BSCard.Text className="mpccard-source">
              {maybeCardDocument !== undefined &&
                maybeCardDocument.source_verbose}
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
