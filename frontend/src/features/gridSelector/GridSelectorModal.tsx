/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
 * Card versions are faceted by source, and all cards for a source can be temporarily hidden.
 */

import React, {
  FormEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";

import { useAppDispatch, useAppSelector } from "@/common/types";
import { AutofillCollapse } from "@/components/AutofillCollapse";
import { CardResultSet } from "@/features/card/CardResultSet";
import { selectFavoriteIdentifiersSet } from "@/store/slices/favoritesSlice";
import {
  selectJumpToVersionVisible,
  toggleJumpToVersionVisible,
} from "@/store/slices/viewSettingsSlice";

interface GridSelectorProps {
  title?: string;
  testId: string;
  imageIdentifiers: Array<string>;
  selectedImage?: string;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
  onClick: {
    (identifier: string): void;
  };
  searchq?: string;
}

export function GridSelectorModal({
  title = "Select Version",
  testId,
  imageIdentifiers,
  selectedImage,
  show,
  handleClose,
  onClick,
  searchq,
}: GridSelectorProps) {
  //# region queries and hooks

  const dispatch = useAppDispatch();

  const jumpToVersionVisible = useAppSelector(selectJumpToVersionVisible);

  // Get favorites for sorting (must match CardResultSet's sorting logic)
  const favoriteIdentifiersSet = useAppSelector(selectFavoriteIdentifiersSet);

  //# endregion

  //# region state

  const [optionNumber, setOptionNumber] = useState<number | undefined>(
    undefined
  );
  const [imageIdentifier, setImageIdentifier] = useState<string>("");
  const focusRef = useRef<HTMLInputElement>(null);

  //# endregion

  //# region computed constants

  // Filter favorites to only those in current results
  const favoriteIdentifiersInResults = useMemo(() => {
    const imageIdentifiersSet = new Set(imageIdentifiers);
    return Array.from(favoriteIdentifiersSet).filter((id) =>
      imageIdentifiersSet.has(id)
    );
  }, [favoriteIdentifiersSet, imageIdentifiers]);

  // Sort identifiers with favorites first (for display order)
  const sortedIdentifiers = useMemo(() => {
    const favoriteSet = new Set(favoriteIdentifiersInResults);
    return [...imageIdentifiers].sort((a, b) => {
      const aIsFavorite = favoriteSet.has(a);
      const bIsFavorite = favoriteSet.has(b);
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return 0;
    });
  }, [imageIdentifiers, favoriteIdentifiersInResults]);

  // Map from identifier to original index (for consistent option numbering)
  const originalIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    imageIdentifiers.forEach((id, index) => map.set(id, index));
    return map;
  }, [imageIdentifiers]);

  // Validation uses original array length and indices
  const versionToJumpToIsValid =
    ((optionNumber ?? 0) > 0 &&
      (optionNumber ?? 0) < imageIdentifiers.length + 1) ||
    (imageIdentifier !== "" && imageIdentifiers.includes(imageIdentifier));

  //# endregion

  //# region callbacks

  const selectImage = useCallback(
    (identifier: string) => {
      onClick(identifier);
      handleClose();
    },
    [onClick, handleClose]
  );
  // "Jump to Version" uses original array indices
  const handleSubmitJumpToVersionForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    selectImage(
      optionNumber ? imageIdentifiers[optionNumber - 1] : imageIdentifier
    );
  };

  //# endregion

  return (
    <Modal
      scrollable
      show={show}
      onEntered={() => {
        if (focusRef.current) {
          focusRef.current.focus();
        }
      }}
      onHide={handleClose}
      size="xl"
      data-testid={testId}
    >
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-grid p-0">
        <AutofillCollapse
          expanded={jumpToVersionVisible}
          onClick={() => dispatch(toggleJumpToVersionVisible())}
          zIndex={0}
          title={<h4>Jump to Version</h4>}
        >
          <>
            <Form
              className="px-3"
              id="jumpToVersionForm"
              onSubmit={handleSubmitJumpToVersionForm}
            >
              <Row className="g-0">
                <Col lg={3} md={5}>
                  <Form.Label>
                    Specify Option Number, <b>or...</b>
                  </Form.Label>
                  <Form.Control
                    ref={focusRef}
                    type="number"
                    pattern="[0-9]*"
                    placeholder="1"
                    value={optionNumber}
                    onChange={(event) =>
                      setOptionNumber(
                        event.target.value
                          ? parseInt(event.target.value)
                          : undefined
                      )
                    }
                    disabled={Boolean(imageIdentifier)}
                  />
                </Col>
                <Col lg={9} md={7}>
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
            <hr />
          </>
        </AutofillCollapse>
        <CardResultSet
          headerText="Browse Versions"
          imageIdentifiers={sortedIdentifiers}
          handleClick={selectImage}
          selectedImage={selectedImage}
          favoriteIdentifiers={favoriteIdentifiersInResults}
          originalIndexMap={originalIndexMap}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
