/**
 * If the user clicks a card in the project editor, this component will be displayed,
 * which is a modal that shows a higher-resolution version of the card,
 * some more information (e.g. size, dote uploaded, etc.), and a button to download the full res image.
 */

import { saveAs } from "file-saver";
import React, { memo, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";
import Tooltip from "react-bootstrap/Tooltip";
import styled from "styled-components";

import { api } from "@/app/api";
import { base64StringToBlob } from "@/common/processing";
import { CardDocument } from "@/common/types";
import { imageSizeToMBString } from "@/common/utils";
import {
  MemoizedCardImage,
  MemoizedCardProportionWrapper,
} from "@/features/card/card";
import DisableSSR from "@/features/ui/disableSSR";
import { Spinner } from "@/features/ui/spinner";

const ClickToCopyIdentifier = styled.code`
  user-select: none;
  outline: solid 1px #ffffff00;
  transition: outline 0.2s ease-in-out;
  &:hover {
    outline-color: #ffffffff;
    cursor: pointer;
  }
`;

interface CardDetailedViewProps {
  cardDocument: CardDocument;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function CardDetailedViewModal({
  cardDocument,
  show,
  handleClose,
}: CardDetailedViewProps) {
  const [triggerFn, getGoogleDriveImageQuery] =
    api.endpoints.getGoogleDriveImage.useLazyQuery();

  const [copied, setCopied] = useState<boolean>(false);
  const copyIdentifier = () => {
    navigator.clipboard.writeText(cardDocument.identifier);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  const downloadImage = async () => {
    const response = await triggerFn(cardDocument.identifier);
    const data = response.data;
    if (data != null) {
      saveAs(
        base64StringToBlob(data),
        `${cardDocument.name} (${cardDocument.identifier}).${cardDocument.extension}`
      );
    }
  };

  return (
    <DisableSSR>
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
                  maybeCardDocument={cardDocument}
                  hidden={false}
                  small={false}
                  showDetailedViewOnClick={false}
                />
              </MemoizedCardProportionWrapper>
            </div>
            <div className="col-lg-7">
              <h4>{cardDocument.name}</h4>
              <Table hover>
                <tbody>
                  <tr>
                    <td>
                      <b>Source Name</b>
                    </td>
                    <td>
                      {cardDocument.source_external_link != null &&
                      cardDocument.source_external_link.length > 0 ? (
                        <a
                          href={cardDocument.source_external_link}
                          target="_blank"
                        >
                          {cardDocument.source_name}
                        </a>
                      ) : (
                        <p>{cardDocument.source_name}</p>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <b>Source Type</b>
                    </td>
                    <td>{cardDocument.source_type}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>Class</b>
                    </td>
                    <td>
                      {cardDocument.card_type.charAt(0).toUpperCase() +
                        cardDocument.card_type.slice(1).toLowerCase()}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <b>Identifier</b>
                    </td>
                    <td>
                      <OverlayTrigger
                        defaultShow={false}
                        placement="top"
                        overlay={
                          <Tooltip id="image-identifier">
                            {copied ? "Copied!" : "Click to copy"}
                          </Tooltip>
                        }
                      >
                        <ClickToCopyIdentifier onClick={copyIdentifier}>
                          {cardDocument.identifier}
                        </ClickToCopyIdentifier>
                      </OverlayTrigger>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <b>Resolution</b>
                    </td>
                    <td>{cardDocument.dpi} DPI</td>
                  </tr>
                  <tr>
                    <td>
                      <b>Date Created</b>
                    </td>
                    <td>{cardDocument.date}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>File Size</b>
                    </td>
                    <td>{imageSizeToMBString(cardDocument.size, 2)}</td>
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
    </DisableSSR>
  );
}

export const MemoizedCardDetailedView = memo(CardDetailedViewModal);
