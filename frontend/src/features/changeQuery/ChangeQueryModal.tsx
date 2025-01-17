import React, { FormEvent, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import { Card } from "@/common/constants";
import { Slots, useAppDispatch } from "@/common/types";
import { clearQueries, setQueries } from "@/features/project/projectSlice";
import { useGetSampleCardsQuery } from "@/store/api";

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
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const sampleCardsQuery = useGetSampleCardsQuery();

  //# endregion

  //# region state

  const [
    changeSelectedImageQueriesModalValue,
    setChangeSelectedImageQueriesModalValue,
  ] = useState<string>("");

  //# endregion

  //# region callbacks

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // to avoid reloading the page
    if (changeSelectedImageQueriesModalValue.length > 0) {
      dispatch(
        setQueries({ query: changeSelectedImageQueriesModalValue, slots })
      );
    } else {
      dispatch(clearQueries({ slots }));
    }
    handleClose();
  };

  //# endregion

  //# region computed constants

  const placeholderCardName =
    sampleCardsQuery.data != null &&
    (sampleCardsQuery.data ?? {})[Card][0] != null
      ? sampleCardsQuery.data[Card][0].name
      : "";

  //# endregion

  return (
    <Modal
      scrollable
      show={show}
      onHide={handleClose}
      onExited={() => setChangeSelectedImageQueriesModalValue("")}
    >
      <Modal.Header closeButton>
        <Modal.Title>Change Query</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Type in a query to update the{" "}
          {slots.length > 1 ? "selected images" : "image"} with and hit{" "}
          <b>Submit</b>.
        </p>
        <p>
          Hit <b>Submit</b> without typing anything to clear{" "}
          {slots.length > 1 ? "their" : "its"} query.
        </p>
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
