import React from "react";
import { useSelector, useDispatch } from "react-redux";
// import { decrement, increment } from './cardSlotSlice'
import { RootState } from "./store";
import { Card } from "./card";
// import styles from './Counter.module.css'

export function CardSlot(props: any) {
  const selectedImage = useSelector(
    (state: RootState) => state.cardSlot.selectedImage
  );
  const face = useSelector((state: RootState) => state.cardSlot.face);
  const dispatch = useDispatch();

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
        <p className="mpccard-slot">Slot N</p>
        <button className="padlock">
          <i className="bi bi-unlock"></i>
        </button>
        <button className="remove">
          <i className="bi bi-x-circle"></i>
        </button>
      </div>
      <Card identifier="Eee"></Card>
      <div className="padding-top" style={{ paddingTop: 20 + "px" }}>
        <button className="prev btn btn-outline-primary">&#10094;</button>
        <button className="next btn btn-outline-primary">&#10095;</button>
      </div>
    </div>
  );
}
