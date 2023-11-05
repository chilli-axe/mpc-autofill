import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import { Back, Front } from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { stringifySearchQuery, toTitleCase } from "@/common/utils";
import { ClickToCopy } from "@/components/clickToCopy";
import { AutofillTable } from "@/components/table";
import {
  clearInvalidIdentifiers,
  selectInvalidIdentifiers,
} from "@/features/invalidIdentifiers/invalidIdentifiersSlice";

interface InvalidIdentifiersModalProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function InvalidIdentifiersModal({
  show,
  handleClose,
}: InvalidIdentifiersModalProps) {
  const dispatch = useAppDispatch();
  const invalidIdentifiers = useAppSelector(selectInvalidIdentifiers);
  const handleAcknowledge = () => {
    dispatch(clearInvalidIdentifiers());
    handleClose();
  };

  const headers = ["Slot", "Face", "Query", "Identifier"];
  const data = invalidIdentifiers.flatMap((row, slot) =>
    row != null
      ? [Front, Back]
          .filter((face) => row[face] != null)
          .map((face) => {
            const [searchQuery, identifier] = row[face] ?? [
              undefined,
              undefined,
            ];
            return [
              slot,
              toTitleCase(face),
              searchQuery ? (
                <ClickToCopy text={stringifySearchQuery(searchQuery)} />
              ) : undefined,
              identifier ? <ClickToCopy text={identifier} /> : undefined,
            ];
          })
      : []
  );
  return (
    <Modal scrollable show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Review Invalid Cards</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Some card versions you specified couldn&apos;t be found. Sorry about
        that!
        <br />
        This typically happens when the creator of the image removed it from
        their repository (even if they reuploaded it later).
        <br />
        The versions we couldn&apos;t find are tabulated below for your
        reference. The cards in these slots have defaulted to the first versions
        we found when searching the database.
        <br />
        Dismiss this warning by clicking the <b>Acknowledge</b> button below.
        <hr />
        <AutofillTable
          headers={headers}
          data={data}
          uniformWidth={false}
          centred={false}
          hover={true}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button variant="primary" onClick={handleAcknowledge}>
          Acknowledge
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
