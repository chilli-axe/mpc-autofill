import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "./store";

import BSCard from "react-bootstrap/Card";
import { CardDetailedView } from "./cardDetailedView";

interface CardProps {
  imageIdentifier: string;
  previousImageIdentifier?: string;
  nextImageIdentifier?: string;
}

export function Card(props: CardProps) {
  const [smallThumbnailLoading, setSmallThumbnailLoading] = useState(true);

  const [nameEditable, setNameEditable] = useState(false);
  const [show, setShow] = useState(false);

  // ensure that the medium thumbnail fades in each time the selected image changes
  // useEffect(() => setMediumThumbnailLoading(true), [props.imageIdentifier]);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

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

  if (maybeCardDocument === undefined) {
    return (
      <div>
        <div className="ratio ratio-7x5">
          <div className="d-flex justify-content-center align-items-center">
            <div
              className="spinner-border"
              style={{ width: 4 + "em", height: 4 + "em" }}
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
        <BSCard.Body className="mb-0 text-center">
          <h5 className="card-subtitle mpccard-name" />
          <div className="mpccard-spacing">
            <p className="card-text mpccard-source" />
          </div>
        </BSCard.Body>
      </div>
    );
  } else {
    return (
      <div>
        <div
          className="rounded-lg shadow-lg ratio ratio-7x5"
          style={{ zIndex: 0 }}
        >
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ display: smallThumbnailLoading ? "block" : "none" }}
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
            onClick={handleShow}
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
        </div>
        <BSCard.Body className="mb-0 text-center">
          <BSCard.Subtitle
            className="mpccard-name"
            // contentEditable="true"  // TODO: sort out a better way of managing text input
            // spellCheck="false"
            // onFocus="Library.review.selectElementContents(this)"
          >
            {maybeCardDocument.name}
          </BSCard.Subtitle>
          <div className="mpccard-spacing">
            <BSCard.Text className="mpccard-source">
              {maybeCardDocument.source_verbose}
            </BSCard.Text>
          </div>
        </BSCard.Body>
        <CardDetailedView
          cardDocument={maybeCardDocument}
          show={show}
          handleClose={handleClose}
        />
      </div>
    );
  }
}
