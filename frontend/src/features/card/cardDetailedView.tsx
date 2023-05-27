/**
 * If the user clicks a card in the project editor, this component will be displayed,
 * which is a modal that shows a higher-resolution version of the card,
 * some more information (e.g. size, dote uploaded, etc.), and a direct download link.
 */

import { saveAs } from "file-saver";
import React, { memo } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";
import { useSelector } from "react-redux";

import { RootState } from "@/app/store";
import { imageSizeToMBString } from "@/common/utils";
import {
  MemoizedCardImage,
  MemoizedCardProportionWrapper,
} from "@/features/card/card";

interface CardDetailedViewProps {
  imageIdentifier: string;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function CardDetailedView({
  imageIdentifier,
  show,
  handleClose,
}: CardDetailedViewProps) {
  const maybeCardDocument = useSelector(
    (state: RootState) => state.cardDocuments.cardDocuments[imageIdentifier]
  );
  const maybeSourceDocuments = useSelector(
    (state: RootState) => state.sourceDocuments.sourceDocuments
  );

  return (
    <div>
      {maybeCardDocument != null && (
        <Modal
          show={show}
          onHide={handleClose}
          size={"xl"}
          data-testid="detailed-view"
        >
          <Modal.Header closeButton>
            <Modal.Title>Card Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <div
                className="col-lg-5 mb-3 mb-lg-0"
                style={{ position: "relative" }}
              >
                <MemoizedCardProportionWrapper small={false}>
                  <MemoizedCardImage
                    cardDocument={maybeCardDocument}
                    hidden={false}
                    small={false}
                  />
                </MemoizedCardProportionWrapper>
              </div>
              <div className="col-lg-7">
                <h4>{maybeCardDocument.name}</h4>
                <Table hover>
                  <tbody>
                    <tr>
                      <td>
                        <b>Source Name</b>
                      </td>
                      <td>
                        {maybeSourceDocuments != null &&
                        maybeSourceDocuments[maybeCardDocument.source_id]
                          .external_link != null ? (
                          <a
                            href={
                              maybeSourceDocuments[maybeCardDocument.source_id]
                                .external_link
                            }
                            target="_blank"
                          >
                            {maybeCardDocument.source_name}
                          </a>
                        ) : (
                          <a>{maybeCardDocument.source_name}</a>
                        )}
                      </td>
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
                <div className="d-grid gap-0">
                  <Button
                    variant="primary"
                    onClick={() =>
                      // TODO: setting the filename like this doesn't work for google drive links :(
                      saveAs(
                        maybeCardDocument.download_link,
                        `${maybeCardDocument.name} (${maybeCardDocument.identifier}).${maybeCardDocument.extension}`
                      )
                    }
                  >
                    Download Image
                  </Button>
                </div>
              </div>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}

export const MemoizedCardDetailedView = memo(CardDetailedView);
