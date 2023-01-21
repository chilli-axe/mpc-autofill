import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "../../app/store";
import { Card } from "./card";
import { Faces, Back, SearchQuery } from "../../common/constants";
import { wrapIndex } from "../../common/utils";
import { deleteImage, setSelectedImage } from "../project/projectSlice";
import Button from "react-bootstrap/Button";
import { CardDetailedView } from "./cardDetailedView";
import { CardSlotGridSelector } from "./gridSelector";

interface CardSlotProps {
  searchQuery?: SearchQuery;
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

  // TODO: move this selector into searchResultsSlice
  // this is a bit confusing. if the card has a query, use the query's results. if it's a cardback with no query,
  // display the common cardback's results.
  const cardbacks =
    useSelector((state: RootState) => state.cardbacks.cardbacks) ?? [];
  const projectCardback = useSelector(
    (state: RootState) => state.project.cardback
  );
  const searchResultsForQuery =
    searchQuery != null
      ? useSelector(
          (state: RootState) =>
            (state.searchResults.searchResults[searchQuery.query] ?? {})[
              searchQuery.card_type
            ] ?? []
        )
      : face == Back
      ? cardbacks
      : [];

  useEffect(() => {
    // If no image is selected and there are search results, select the first image in search results
    if (
      (searchResultsForQuery.length > 0 && selectedImage === null) ||
      selectedImage === undefined
    ) {
      if (searchQuery != null) {
        dispatch(
          setSelectedImage({
            face: face,
            slot: slot,
            selectedImage: searchResultsForQuery[0],
          })
        );
      } else if (face == Back && projectCardback != null) {
        dispatch(
          setSelectedImage({
            face: face,
            slot: slot,
            selectedImage: projectCardback,
          })
        );
      }
    }
  }, [searchResultsForQuery, projectCardback]);

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
        noResultsFound={
          searchResultsForQuery.length == 0 && searchQuery == null
        }
      />

      <CardDetailedView
        imageIdentifier={selectedImage}
        show={showDetailedView}
        handleClose={handleCloseDetailedView}
      />

      {searchResultsForQuery.length > 1 && (
        <CardSlotGridSelector
          face={face}
          slot={slot}
          searchResultsForQuery={searchResultsForQuery}
          show={showGridSelector}
          handleClose={handleCloseGridSelector}
        />
      )}
    </>
  );
}
