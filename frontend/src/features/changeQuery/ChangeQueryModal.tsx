import React, { FormEvent, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import BSCard from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import { Card } from "@/common/constants";
import { Back, Front } from "@/common/constants";
import { getDfcBack } from "@/common/processing";
import { Slots, useAppDispatch, useAppSelector } from "@/common/types";
import { useGetDFCPairsQuery, useGetSampleCardsQuery } from "@/store/api";
import {
  clearQueries,
  selectAnySelectedProjectMembersMatchQuery,
  setQueries,
} from "@/store/slices/projectSlice";
import { selectFuzzySearch } from "@/store/slices/searchSettingsSlice";

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
  const dfcPairsQuery = useGetDFCPairsQuery();
  const fuzzySearch = useAppSelector(selectFuzzySearch);

  const dfcPairs = dfcPairsQuery.data ?? {};

  //# endregion

  //# region state

  // cooked up here: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevShow, setPrevShow] = useState(show);
  const [
    changeSelectedImageQueriesModalValue,
    setChangeSelectedImageQueriesModalValue,
  ] = useState<string>(query ?? "");
  const [updateBacks, setUpdateBacks] = useState<boolean>(false);
  const [revertToDefaultBack, setRevertToDefaultBack] =
    useState<boolean>(false);
  useEffect(() => {
    setUpdateBacks(false);
    setRevertToDefaultBack(false);
  }, [show]);

  const dfcBack = getDfcBack(
    changeSelectedImageQueriesModalValue,
    dfcPairs,
    fuzzySearch
  );

  const areAllSlotsFront = slots.every(([face, slotNumber]) => face === Front);
  const areAllSlotsBack = slots.every(([face, slotNumber]) => face === Back);
  const doAllSlotsHaveDifferentBack = !useAppSelector((state) =>
    selectAnySelectedProjectMembersMatchQuery(state, slots, Back, dfcBack)
  );
  const shouldShowDfcBackChangeSuggestion =
    dfcBack !== null && areAllSlotsFront && doAllSlotsHaveDifferentBack;
  const showRevertToDefaultBack = areAllSlotsBack && (query ?? "") !== "";

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
    const query = revertToDefaultBack
      ? ""
      : changeSelectedImageQueriesModalValue;
    if (query.length > 0) {
      dispatch(setQueries({ query: query, slots }));
      if (updateBacks && dfcBack) {
        dispatch(
          setQueries({
            query: dfcBack,
            slots: slots.map(([face, slotNumber]) => [Back, slotNumber]),
          })
        );
      }
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
              disabled={revertToDefaultBack}
            />
          </Form.Group>
          {shouldShowDfcBackChangeSuggestion && (
            <BSCard border="primary" bg="secondary">
              <BSCard.Body>
                Your updated query matches a double-faced card pair.
                <br />
                Would you like to update the{" "}
                <b>back{slots.length !== 1 ? "s" : ""}</b> of{" "}
                {slots.length === 1 ? "this slot" : "the selected slots"} to{" "}
                <code>{dfcBack}</code>?
                <br />
                <Form.Check // prettier-ignore
                  type="switch"
                  id="custom-switch"
                  label={`Update back${slots.length !== 1 ? "s" : ""}`}
                  checked={updateBacks}
                  onChange={(event) => setUpdateBacks(event.target.checked)}
                />
              </BSCard.Body>
            </BSCard>
          )}
          {showRevertToDefaultBack && (
            <BSCard border="warning" bg="secondary">
              <BSCard.Body>
                <Form.Check // prettier-ignore
                  type="switch"
                  id="custom-switch"
                  label={`Change ${
                    slots.length === 1 ? "this slot" : "the selected slots"
                  } to the default cardback?`}
                  checked={revertToDefaultBack}
                  onChange={(event) =>
                    setRevertToDefaultBack(event.target.checked)
                  }
                />
              </BSCard.Body>
            </BSCard>
          )}
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
