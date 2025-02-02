/**
 * If the user clicks a card in the project editor, this component will be displayed,
 * which is a modal that shows a higher-resolution version of the card,
 * some more information (e.g. size, dote uploaded, etc.), and a button to download the full res image.
 */

import React, { memo } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";

import { CardDocument, useAppDispatch } from "@/common/types";
import { imageSizeToMBString, toTitleCase } from "@/common/utils";
import { AutofillTable } from "@/components/AutofillTable";
import { ClickToCopy } from "@/components/ClickToCopy";
import DisableSSR from "@/components/DisableSSR";
import { RightPaddedIcon } from "@/components/icon";
import { AddCardToProjectForm } from "@/features/card/AddCardToProjectForm";
import {
  MemoizedCardImage,
  MemoizedCardProportionWrapper,
} from "@/features/card/Card";
import { useQueueImageDownload } from "@/features/download/downloadImages";
import { useGetLanguagesQuery } from "@/store/api";
import { setNotification } from "@/store/slices/toastsSlice";

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

  const dispatch = useAppDispatch();
  const queueImageDownload = useQueueImageDownload();
  const getLanguagesQuery = useGetLanguagesQuery();

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
                    cardDocument.sourceExternalLink != null &&
                    cardDocument.sourceExternalLink.length > 0 ? (
                      <a href={cardDocument.sourceExternalLink} target="_blank">
                        {cardDocument.sourceName}
                      </a>
                    ) : (
                      cardDocument.sourceName
                    ),
                  ],
                  ["Source Type", cardDocument.sourceType],
                  ["Class", toTitleCase(cardDocument.cardType)],
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
                  onClick={async () => {
                    queueImageDownload(cardDocument);
                    dispatch(
                      setNotification([
                        Math.random().toString(),
                        {
                          name: "Enqueued Downloads",
                          message: `Enqueued 1 image download!`,
                          level: "info",
                        },
                      ])
                    );
                  }}
                >
                  <RightPaddedIcon bootstrapIconName="cloud-arrow-down" />{" "}
                  Download Image
                </Button>
              </div>
              <AddCardToProjectForm cardDocument={cardDocument} />
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
