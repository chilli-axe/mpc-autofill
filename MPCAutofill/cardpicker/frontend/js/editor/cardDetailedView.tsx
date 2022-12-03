import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";
import { downloadImage, imageSizeToMBString } from "./utils";
import Button from "react-bootstrap/Button";
import React, { useEffect, useState } from "react";
import { CardDocument } from "./cardDocumentsSlice";

interface CardDetailedViewProps {
  cardDocument: CardDocument;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function CardDetailedView(props: CardDetailedViewProps) {
  const [mediumThumbnailLoading, setMediumThumbnailLoading] = useState(true);
  useEffect(() => setMediumThumbnailLoading(true), [props.cardDocument]);

  return (
    <Modal show={props.show} onHide={props.handleClose} size={"xl"}>
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
                src={props.cardDocument.medium_thumbnail_url}
                onLoad={() => setMediumThumbnailLoading(false)}
                // onError={{thumbnail_404(this)}}
              />
            </div>
          </div>
          <div className="col-lg-7">
            <h4>{props.cardDocument.name}</h4>
            <Table hover>
              <tbody>
                <tr>
                  <td>
                    <b>Source Name</b>
                  </td>
                  <td>{props.cardDocument.source}</td>
                </tr>
                <tr>
                  <td>
                    <b>Source Type</b>
                  </td>
                  <td>{props.cardDocument.source_type}</td>
                </tr>
                <tr>
                  <td>
                    <b>Class</b>
                  </td>
                  <td>
                    {props.cardDocument.card_type.charAt(0).toUpperCase() +
                      props.cardDocument.card_type.slice(1).toLowerCase()}
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Identifier</b>
                  </td>
                  <td>
                    <code>{props.cardDocument.identifier}</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Resolution</b>
                  </td>
                  <td>{props.cardDocument.dpi} DPI</td>
                </tr>
                <tr>
                  <td>
                    <b>Date Created</b>
                  </td>
                  <td>{props.cardDocument.date}</td>
                </tr>
                <tr>
                  <td>
                    <b>File Size</b>
                  </td>
                  <td>{imageSizeToMBString(props.cardDocument.size, 2)}</td>
                </tr>
              </tbody>
            </Table>
            <div className="d-grid gap-0">
              <Button
                variant="primary"
                onClick={() => downloadImage(props.cardDocument.download_link)}
              >
                Download Image
              </Button>
            </div>
          </div>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
