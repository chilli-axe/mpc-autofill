import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
// import { decrement, increment } from './cardSlotSlice'
import { RootState } from "./store";
import { Card } from "./card";
import { Faces, SearchQuery } from "./constants";
import { Root } from "react-dom/client";

// import styles from './Counter.module.css'

export function CardSlot(props: any) {
  // props should contain face, slot number, and search query
  // state should contain selected image
  // const selectedImage = useSelector(
  //   (state: RootState) => state.cardSlot.selectedImage
  // );
  // const face = useSelector((state: RootState) => state.cardSlot.face);
  // const dispatch = useDispatch();

  const searchQuery: SearchQuery = props.searchQuery;
  const face: Faces = props.face;
  const slot: number = props.slot;

  let initialSelectedImage = null;
  const [selectedImage, setSelectedImage] = useState(initialSelectedImage);

  // @ts-ignore
  const searchResultsForQuery = useSelector(
    (state: RootState) =>
      (state.searchResults.searchResults[searchQuery.query] ?? {})[
        searchQuery.card_type
      ] ?? []
  );
  // alert(maybeSearchResultsForQuery)
  if (searchResultsForQuery.length > 0 && selectedImage === null) {
    // alert(searchResultsForQuery[0])
    setSelectedImage(searchResultsForQuery[0]);
  }

  const selectedImageIndex = searchResultsForQuery.indexOf(selectedImage);
  // if (maybeSearchResultsForQuery !== undefined) {
  //   // @ts-ignore
  //   const maybeSearchResultsForQueryAndCardType = useSelector((state: RootState) => state.searchResults.searchResults[searchQuery.query][searchQuery.card_type])
  //   if (maybeSearchResultsForQueryAndCardType !== undefined) {
  //     alert("thing is not undefined!")
  //     alert(maybeSearchResultsForQueryAndCardType[0])
  //     // initialSelectedImage = maybeSearchResultsForQueryAndCardType[0]
  //   }
  // }

  // const [searchQuery, setSearchQuery] = useState({query: null, card_type: null});

  return (
    // <div>
    //   <h1>My face: {face}</h1>
    //   <div>
    //     <button
    //       aria-label="Increment value"
    //       onClick={() => dispatch(increment())}
    //     >
    //       Increment
    //     </button>
    //     <span>{selectedImage}</span>
    //     <button
    //       aria-label="Decrement value"
    //       onClick={() => dispatch(decrement())}
    //     >
    //       Decrement
    //     </button>
    //   </div>
    // </div>

    // style={{opacity: 0}}
    <div className="card mpccard">
      <div className="card-header pb-0 text-center">
        <p className="mpccard-slot">Slot {slot + 1}</p>
        <button className="padlock">
          <i className="bi bi-unlock"></i>
        </button>
        <button className="remove">
          <i className="bi bi-x-circle"></i>
        </button>
      </div>
      <Card
        identifier={selectedImage}
        index={selectedImageIndex}
        hits={searchResultsForQuery.length}
      ></Card>
      <div className="padding-top" style={{ paddingTop: 20 + "px" }}>
        <button className="prev btn btn-outline-primary">&#10094;</button>
        <button className="next btn btn-outline-primary">&#10095;</button>
      </div>
    </div>
  );
}
