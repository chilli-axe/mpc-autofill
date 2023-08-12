import React, { FormEvent, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import { useGetSampleCardsQuery } from "@/app/api";
import { Card } from "@/common/constants";
import { Slots, useAppDispatch } from "@/common/types";
import { bulkSetQuery } from "@/features/project/projectSlice";

interface ChangeQueryModalProps {
  slots: Slots;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function ChangeQueryModal({
  slots,
  show,
  handleClose,
}: ChangeQueryModalProps) {
  const dispatch = useAppDispatch();

  const sampleCardsQuery = useGetSampleCardsQuery();
  const placeholderCardName =
    sampleCardsQuery.data != null &&
    (sampleCardsQuery.data ?? {})[Card][0] != null
      ? sampleCardsQuery.data[Card][0].name
      : "";

  const [
    changeSelectedImageQueriesModalValue,
    setChangeSelectedImageQueriesModalValue,
  ] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // to avoid reloading the page
    dispatch(
      bulkSetQuery({ query: changeSelectedImageQueriesModalValue, slots })
    );
    handleClose();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      onExited={() => setChangeSelectedImageQueriesModalValue("")}
    >
      <Modal.Header closeButton>
        <Modal.Title>Change Query</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Type in a query to update the selected images with and hit <b>Submit</b>
        .
        <hr />
        <Form onSubmit={handleSubmit} id="changeSelectedImageQueriesForm">
          <Form.Group className="mb-3">
            <Form.Control
              type="text"
              placeholder={placeholderCardName}
              onChange={(event) =>
                setChangeSelectedImageQueriesModalValue(event.target.value)
              }
              value={changeSelectedImageQueriesModalValue}
              aria-label="change-selected-image-queries-text"
              required={true}
              autoFocus={true}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button
          type="submit"
          form="changeSelectedImageQueriesForm"
          variant="primary"
          aria-label="change-selected-image-queries-submit"
        >
          Submit
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
