import React, { FormEvent, useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";

import {
  ProjectMaxSize,
  ReversedCardTypePrefixes,
  SelectedImageSeparator,
} from "@/common/constants";
import {
  convertLinesIntoSlotProjectMembers,
  processLine,
} from "@/common/processing";
import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { useGetDFCPairsQuery } from "@/store/api";
import { addMembers, selectProjectSize } from "@/store/slices/projectSlice";
import { selectFuzzySearch } from "@/store/slices/SearchSettingsSlice";
import { setNotification } from "@/store/slices/toastsSlice";

export function AddCardToProjectForm({
  cardDocument,
}: {
  cardDocument: CardDocument;
}) {
  const dispatch = useAppDispatch();
  const dfcPairsQuery = useGetDFCPairsQuery();
  const fuzzySearch = useAppSelector(selectFuzzySearch);

  const projectSize = useAppSelector(selectProjectSize);
  const maxQuantity = ProjectMaxSize - projectSize;
  const atMaxCapacity = maxQuantity === 0;
  const [quantity, setQuantity] = useState<number>(1);
  const handleAddToProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // to prevent reloading the page

    const prefix = ReversedCardTypePrefixes[cardDocument.card_type];
    const lineString = `${quantity} ${prefix}${cardDocument.name}${SelectedImageSeparator}${cardDocument.identifier}`;
    const line = processLine(lineString, dfcPairsQuery.data ?? {}, fuzzySearch);

    dispatch(
      addMembers({
        members: convertLinesIntoSlotProjectMembers([line], projectSize),
      })
    );
    dispatch(
      setNotification([
        Math.random().toString(),
        {
          name: "Added to Project",
          message: `Added ${quantity} ${quantity > 1 ? "copies" : "copy"} of ${
            cardDocument.name
          } to your project!`,
          level: "info",
        },
      ])
    );
    setQuantity(1);
  };

  return (
    <Form onSubmit={handleAddToProject}>
      <Row className="g-0 pt-3">
        <Col lg={2} md={3}>
          <Form.Control
            type="number"
            pattern="[0-9]*"
            placeholder="1"
            min={1}
            max={maxQuantity}
            value={atMaxCapacity ? 0 : quantity}
            disabled={atMaxCapacity}
            onChange={(event) => {
              if (event.target.value) {
                setQuantity(parseInt(event.target.value));
              }
            }}
          />
        </Col>
        <Col lg={10} md={9}>
          <div className="d-grid gap-0">
            <Button variant="success" type="submit" disabled={atMaxCapacity}>
              <RightPaddedIcon bootstrapIconName="plus-circle" /> Add to Project
            </Button>
          </div>
        </Col>
      </Row>
    </Form>
  );
}
