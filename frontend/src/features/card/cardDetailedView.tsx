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

import { api } from "@/app/api";
import { RootState } from "@/app/store";
import { base64StringToBlob } from "@/common/processing";
import { CardDocument } from "@/common/types";
import { imageSizeToMBString } from "@/common/utils";
import {
  MemoizedCardImage,
  MemoizedCardProportionWrapper,
} from "@/features/card/card";
import DisableSSR from "@/features/ui/disableSSR";
import { Spinner } from "@/features/ui/spinner";

interface CardDetailedViewProps {
  imageIdentifier: string;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
  cardDocument?: CardDocument;
}

export function CardDetailedView({
  imageIdentifier,
  show,
  handleClose,
  cardDocument,
}: CardDetailedViewProps) {
  const maybeCardDocument = useSelector((state: RootState) =>
    cardDocument != null
      ? cardDocument
      : state.cardDocuments.cardDocuments[imageIdentifier]
  );
  const maybeSourceDocuments = useSelector(
    (state: RootState) => state.sourceDocuments.sourceDocuments
  );

  const [triggerFn, getGoogleDriveImageQuery] =
    api.endpoints.getGoogleDriveImage.useLazyQuery();

  const downloadImage = async () => {
    const response = await triggerFn(maybeCardDocument.identifier);
    const data = response.data;
    if (data != null) {
      saveAs(
        base64StringToBlob(data),
        `${maybeCardDocument.name} (${maybeCardDocument.identifier}).${maybeCardDocument.extension}`
      );
    }
  };

  return (
    <DisableSSR>
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
                                maybeSourceDocuments[
                                  maybeCardDocument.source_id
                                ].external_link ?? undefined
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
                        <td>
                          {imageSizeToMBString(maybeCardDocument.size, 2)}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                  <div className="d-grid gap-0">
                    <Button
                      variant="primary"
                      onClick={downloadImage}
                      disabled={getGoogleDriveImageQuery.isFetching}
                    >
                      {getGoogleDriveImageQuery.isFetching ? (
                        <Spinner size={1.5} />
                      ) : (
                        "Download Image"
                      )}
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
    </DisableSSR>
  );
}

export const MemoizedCardDetailedView = memo(CardDetailedView);
