import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import { Back, Front } from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { stringifySearchQuery, toTitleCase } from "@/common/utils";
import { AutofillTable } from "@/components/AutofillTable";
import { ClickToCopy } from "@/components/ClickToCopy";
import {
  clearInvalidIdentifiers,
  selectInvalidIdentifiers,
} from "@/store/slices/invalidIdentifiersSlice";

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
    [Front, Back]
      .filter((face) => row[face] != null)
      .map((face) => {
        const [searchQuery, identifier] = row[face] ?? [undefined, undefined];
        return [
          slot + 1, // from the user's perspective, slot numbers are 1-indexed
          toTitleCase(face),
          searchQuery ? (
            <ClickToCopy text={stringifySearchQuery(searchQuery)} />
          ) : undefined,
          identifier ? <ClickToCopy text={identifier} /> : undefined,
        ];
      })
  );
  return (
    <Modal scrollable show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Invalid Cards</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Some card versions you specified couldn&apos;t be found. This
          typically happens when:
        </p>
        <ul>
          <li>
            You had selected an image, then disabled its source in Search
            Settings, or
          </li>
          <li>
            The creator of the image removed it from their repository (even if
            they reuploaded it later).
          </li>
        </ul>
        <p>
          The versions we couldn&apos;t find are tabulated below for your
          reference. The cards in these slots have defaulted to the first
          versions we found when searching the database.
        </p>
        <p>
          Dismiss this warning by clicking the <b>Acknowledge</b> button below.
        </p>
        <hr />
        <AutofillTable
          headers={headers}
          data={data}
          uniformWidth={false}
          alignment={"left"}
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
