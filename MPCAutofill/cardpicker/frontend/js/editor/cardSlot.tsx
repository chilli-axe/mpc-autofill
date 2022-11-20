import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "./store";
import { Card } from "./card";
import { Faces, SearchQuery } from "./constants";
import { wrapIndex } from "./utils";
import { setSelectedImage } from "./projectSlice";
import BSCard from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

interface CardSlotProps {
  searchQuery: SearchQuery;
  face: Faces;
  slot: number;
  selectedImage?: string;
}

export function CardSlot(props: CardSlotProps) {
  const searchQuery: SearchQuery = props.searchQuery;
  const face = props.face;
  const slot = props.slot;
  let selectedImage = props.selectedImage;

  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const dispatch = useDispatch<AppDispatch>();

  const searchResultsForQuery = useSelector(
    (state: RootState) =>
      (state.searchResults.searchResults[searchQuery.query] ?? {})[
        searchQuery.card_type
      ] ?? []
  ); // TODO: move this selector into searchResultsSlice

  useEffect(() => {
    // If no image is selected and there are search results, select the first image in search results
    if (
      (searchResultsForQuery.length > 0 && selectedImage === null) ||
      selectedImage === undefined
    ) {
      dispatch(
        setSelectedImage({
          face,
          slot,
          selectedImage: searchResultsForQuery[0],
        })
      );
    }
  }, [searchResultsForQuery]);

  const selectedImageIndex = searchResultsForQuery.indexOf(selectedImage);
  const previousImage =
    searchResultsForQuery[
      wrapIndex(selectedImageIndex + 1, searchResultsForQuery.length)
    ];
  const nextImage =
    searchResultsForQuery[
      wrapIndex(selectedImageIndex - 1, searchResultsForQuery.length)
    ];

  function setSelectedImageFromDelta(delta: number): void {
    // TODO: docstring
    dispatch(
      setSelectedImage({
        face,
        slot,
        selectedImage:
          searchResultsForQuery[
            wrapIndex(selectedImageIndex + delta, searchResultsForQuery.length)
          ],
      })
    );
  }

  let counterElement = (
    <p className="mpccard-counter">
      {selectedImageIndex + 1} / {searchResultsForQuery.length}
    </p>
  );
  if (searchResultsForQuery.length == 0) {
    counterElement.props.style = { opacity: 0 };
  }
  if (searchResultsForQuery.length > 1) {
    counterElement = (
      <Button
        variant="outline-info"
        className="mpccard-counter-btn"
        onClick={handleShow}
      >
        {selectedImageIndex + 1} / {searchResultsForQuery.length}
      </Button>
    );
  }

  return (
    <>
      <BSCard className="mpccard mpccard-hover">
        <BSCard.Header className="pb-0 text-center">
          <p className="mpccard-slot">Slot {slot + 1}</p>
          <button className="padlock">
            <i className="bi bi-unlock"></i>
          </button>
          <button className="remove">
            <i className="bi bi-x-circle"></i>
          </button>
        </BSCard.Header>
        <Card
          imageIdentifier={selectedImage}
          previousImageIdentifier={previousImage}
          nextImageIdentifier={nextImage}
        ></Card>
        <BSCard.Footer
          className="padding-top"
          style={{ paddingTop: 50 + "px" }}
        >
          {counterElement}
          {searchResultsForQuery.length > 1 && (
            <div>
              <Button
                variant="outline-primary"
                className="prev"
                onClick={() => setSelectedImageFromDelta(-1)}
              >
                &#10094;
              </Button>
              <Button
                variant="outline-primary"
                className="next"
                onClick={() => setSelectedImageFromDelta(1)}
              >
                &#10095;
              </Button>
            </div>
          )}
        </BSCard.Footer>
      </BSCard>

      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Select Version</Modal.Title>
        </Modal.Header>
        <Modal.Body>In Progress</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleClose}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
