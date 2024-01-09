/**
 * If the user clicks a card in the project editor, this component will be displayed,
 * which is a modal that shows a higher-resolution version of the card,
 * some more information (e.g. size, dote uploaded, etc.), and a button to download the full res image.
 */

import { saveAs } from "file-saver";
import React, { memo } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";

import { api, useGetLanguagesQuery } from "@/app/api";
import { base64StringToBlob } from "@/common/processing";
import { CardDocument } from "@/common/types";
import { imageSizeToMBString, toTitleCase } from "@/common/utils";
import { ClickToCopy } from "@/components/clickToCopy";
import DisableSSR from "@/components/disableSSR";
import { Spinner } from "@/components/spinner";
import { AutofillTable } from "@/components/table";
import {
  MemoizedCardImage,
  MemoizedCardProportionWrapper,
} from "@/features/card/card";

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
  //# region queries and hooks

  const [triggerFn, getGoogleDriveImageQuery] =
    api.endpoints.getGoogleDriveImage.useLazyQuery();
  const getLanguagesQuery = useGetLanguagesQuery();

  //# endregion

  //# region callbacks

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

  //# endregion

  //# region computed constants

  const languageNameByCode = Object.fromEntries(
    (getLanguagesQuery.data ?? []).map((row) => [row.code, row.name])
  );

  //# endregion

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
              <AutofillTable
                headers={[]}
                data={[
                  [
                    "Source Name",
                    cardDocument.source_external_link != null &&
                    cardDocument.source_external_link.length > 0 ? (
                      <a
                        href={cardDocument.source_external_link}
                        target="_blank"
                      >
                        {cardDocument.source_name}
                      </a>
                    ) : (
                      cardDocument.source_name
                    ),
                  ],
                  ["Source Type", cardDocument.source_type],
                  ["Class", toTitleCase(cardDocument.card_type)],
                  [
                    "Identifier",
                    <ClickToCopy
                      key={`${cardDocument.identifier}-click-to-copy`}
                      text={cardDocument.identifier}
                    />,
                  ],
                  ["Language", languageNameByCode[cardDocument.language]],
                  [
                    "Tags",
                    cardDocument.tags.length > 0 ? (
                      <>
                        {cardDocument.tags.map((tag) => (
                          <Badge key={tag} pill>
                            {tag}
                          </Badge>
                        ))}
                      </>
                    ) : (
                      "Untagged"
                    ),
                  ],
                  ["Resolution", `${cardDocument.dpi} DPI`],
                  ["Date Created", cardDocument.date],
                  ["File Size", imageSizeToMBString(cardDocument.size, 2)],
                ]}
                hover={true}
                centred={false}
                uniformWidth={false}
                columnLabels={true}
              />
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
