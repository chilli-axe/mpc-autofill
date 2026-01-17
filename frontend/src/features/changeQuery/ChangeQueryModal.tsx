import React, { FormEvent, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import { Card } from "@/common/constants";
import { Slots, useAppDispatch } from "@/common/types";
import { useGetSampleCardsQuery } from "@/store/api";
import { clearQueries, setQueries } from "@/store/slices/projectSlice";

interface ChangeQueryModalProps {
  slots: Slots;
  query: string | null;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function ChangeQueryModal({
  slots,
  query,
  show,
  handleClose,
}: ChangeQueryModalProps) {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const sampleCardsQuery = useGetSampleCardsQuery();

  //# endregion

  //# region state

  // cooked up here: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevShow, setPrevShow] = useState(show);
  const [
    changeSelectedImageQueriesModalValue,
    setChangeSelectedImageQueriesModalValue,
  ] = useState<string>(query ?? "");

  //# endregion

  //# region callbacks

  if (show !== prevShow) {
    setPrevShow(show);
    if (!prevShow && show) {
      setChangeSelectedImageQueriesModalValue(query ?? "");
    }
  }

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
      data-testid="change-query-modal"
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
          Clear the textbox and hit <b>Submit</b> to clear{" "}
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
              onFocus={(event) => event.target.select()}
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
