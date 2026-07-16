import { FormEvent, Ref, useCallback, useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";

import { useAppDispatch, useAppSelector } from "@/common/types";
import { AutofillCollapse } from "@/components/AutofillCollapse";
import {
  selectJumpToVersionVisible,
  toggleJumpToVersionVisible,
} from "@/store/slices/viewSettingsSlice";

interface JumpToVersionProps {
  imageIdentifiers: Array<string>;
  focusRef: Ref<HTMLInputElement>;
  selectImage: (identifier: string) => void;
}

export const JumpToVersion = ({
  imageIdentifiers,
  focusRef,
  selectImage,
}: JumpToVersionProps) => {
  const [optionNumber, setOptionNumber] = useState<number | undefined>(
    undefined
  );
  const [imageIdentifier, setImageIdentifier] = useState<string>("");

  const handleSubmitJumpToVersionForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    selectImage(
      optionNumber ? imageIdentifiers[optionNumber - 1] : imageIdentifier
    );
  };

  const versionToJumpToIsValid =
    ((optionNumber ?? 0) > 0 &&
      (optionNumber ?? 0) < imageIdentifiers.length + 1) ||
    (imageIdentifier !== "" && imageIdentifiers.includes(imageIdentifier));

  return (
    <Form id="jumpToVersionForm" onSubmit={handleSubmitJumpToVersionForm}>
      <Row className="g-0">
        <Col xs={12}>
          <Form.Label>
            Specify option number, <b>or...</b>
          </Form.Label>
          <Form.Control
            ref={focusRef}
            type="number"
            pattern="[0-9]*"
            placeholder="1"
            value={optionNumber}
            onChange={(event) =>
              setOptionNumber(
                event.target.value ? parseInt(event.target.value) : undefined
              )
            }
            disabled={Boolean(imageIdentifier)}
          />
        </Col>
        <Col xs={12} className="mt-2">
          <Form.Label>Specify ID</Form.Label>
          <Form.Control
            type="text"
            placeholder={imageIdentifiers[0]}
            value={imageIdentifier}
            onChange={(event) => setImageIdentifier(event.target.value)}
            disabled={Boolean(optionNumber)}
          />
        </Col>
      </Row>
      <div className="d-grid gap-0 pt-3">
        <Button
          variant="primary"
          form="jumpToVersionForm"
          type="submit"
          aria-label="jump-to-version-submit"
          disabled={!versionToJumpToIsValid}
        >
          Select This Version
        </Button>
      </div>
    </Form>
  );
};
