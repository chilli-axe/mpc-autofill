import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "./store";

import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";
import BSCard from "react-bootstrap/Card";
import { imageSizeToMBString } from "./utils";

interface CardProps {
  imageIdentifier: string;
  previousImageIdentifier: string;
  nextImageIdentifier: string;
}

export function Card(props: CardProps) {
  const [smallThumbnailLoading, setSmallThumbnailLoading] = useState(true);
  const [mediumThumbnailLoading, setMediumThumbnailLoading] = useState(true);
  const [nameEditable, setNameEditable] = useState(false);
  const [show, setShow] = useState(false);

  // ensure that the medium thumbnail fades in each time the selected image changes
  useEffect(() => setMediumThumbnailLoading(true), [props.imageIdentifier]);

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

        <Modal show={show} onHide={handleClose} size={"xl"}>
          <Modal.Header closeButton>
            <Modal.Title>Card Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <div
                className="col-lg-5 mb-3 mb-lg-0"
                style={{ position: "relative" }}
              >
                <div
                  className="rounded-xl shadow-lg ratio ratio-7x5"
                  style={{ zIndex: 0 }}
                >
                  <div
                    className="d-flex justify-content-center align-items-center"
                    style={{
                      display: mediumThumbnailLoading ? "block" : "none",
                    }}
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
                    className="card-img-fade-in"
                    style={{
                      zIndex: 1,
                      opacity: mediumThumbnailLoading ? 0 : 1,
                    }}
                    src={maybeCardDocument.medium_thumbnail_url}
                    onLoad={() => setMediumThumbnailLoading(false)}
                    // onError={{thumbnail_404(this)}}
                  />
                </div>
              </div>
              <div className="col-lg-7">
                <h4>{maybeCardDocument.name}</h4>
                <Table hover>
                  <tbody>
                    <tr>
                      <td>
                        <b>Source Name</b>
                      </td>
                      <td>{maybeCardDocument.source}</td>
                    </tr>
                    <tr>
                      <td>
                        <b>Source Type</b>
                      </td>
                      <td>{maybeCardDocument.source_type}</td>
                    </tr>
                    <tr>
                      <td>
                        <b>Class</b>
                      </td>
                      <td>
                        {maybeCardDocument.card_type.charAt(0).toUpperCase() +
                          maybeCardDocument.card_type.slice(1).toLowerCase()}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Identifier</b>
                      </td>
                      <td>
                        <code>{maybeCardDocument.identifier}</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Resolution</b>
                      </td>
                      <td>{maybeCardDocument.dpi} DPI</td>
                    </tr>
                    <tr>
                      <td>
                        <b>Date Created</b>
                      </td>
                      <td>{maybeCardDocument.date}</td>
                    </tr>
                    <tr>
                      <td>
                        <b>File Size</b>
                      </td>
                      <td>{imageSizeToMBString(maybeCardDocument.size, 2)}</td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}
