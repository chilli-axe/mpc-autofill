import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "./store";
import { Card } from "./card";
import { Faces, SearchQuery } from "./constants";
import { wrapIndex } from "./utils";
import { deleteImage, setSelectedImage } from "./projectSlice";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { CardDetailedView } from "./cardDetailedView";

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

  const [showDetailedView, setShowDetailedView] = useState(false);
  const [showGridSelector, setShowGridSelector] = useState(false);

  const handleCloseDetailedView = () => setShowDetailedView(false);
  const handleShowDetailedView = () => setShowDetailedView(true);
  const handleCloseGridSelector = () => setShowGridSelector(false);
  const handleShowGridSelector = () => setShowGridSelector(true);

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

  const deleteThisImage = () => {
    dispatch(deleteImage({ slot }));
  };

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
  function setSelectedImageFromIdentifier(selectedImage: string): void {
    dispatch(setSelectedImage({ face, slot, selectedImage }));
  }

  const cardHeaderTitle = `Slot ${slot + 1}`;
  const cardHeaderButtons = (
    <>
      <button className="padlock">
        <i className="bi bi-unlock"></i>
      </button>
      <button className="remove">
        <i className="bi bi-x-circle" onClick={deleteThisImage}></i>
      </button>
    </>
  );
  const cardFooter = (
    <>
      {searchResultsForQuery.length == 1 && (
        <p className="mpccard-counter text-center align-middle">
          1 / {searchResultsForQuery.length}
        </p>
      )}
      {searchResultsForQuery.length > 1 && (
        <>
          <Button
            variant="outline-info"
            className="mpccard-counter-btn"
            onClick={handleShowGridSelector}
          >
            {selectedImageIndex + 1} / {searchResultsForQuery.length}
          </Button>
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
        </>
      )}
    </>
  );

  return (
    <>
      <Card
        imageIdentifier={selectedImage}
        previousImageIdentifier={previousImage}
        nextImageIdentifier={nextImage}
        cardHeaderTitle={cardHeaderTitle}
        cardFooter={cardFooter}
        cardHeaderButtons={cardHeaderButtons}
        imageOnClick={handleShowDetailedView}
      />

      {/*TODO: this grid selector should be its own component */}
      <Modal
        show={showGridSelector}
        onHide={handleCloseGridSelector}
        size={"lg"}
      >
        <Modal.Header closeButton>
          <Modal.Title>Select Version</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-0" xxl={4} xl={4} lg={3} md={2} sm={2} xs={2}>
            {searchResultsForQuery.map((identifier, index) => (
              <Card // TODO: paginate or lazy-load these
                imageIdentifier={identifier}
                cardHeaderTitle={`Option ${index + 1}`}
                imageOnClick={() => {
                  setSelectedImageFromIdentifier(identifier);
                  handleCloseGridSelector();
                }}
                key={`${face}-${slot}-${identifier}`}
              />
            ))}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseGridSelector}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <CardDetailedView
        imageIdentifier={selectedImage}
        show={showDetailedView}
        handleClose={handleCloseDetailedView}
      />
    </>
  );
}
