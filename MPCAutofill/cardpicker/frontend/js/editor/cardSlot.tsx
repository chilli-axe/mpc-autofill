import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
// import { decrement, increment } from './cardSlotSlice'
import { RootState } from "./store";
// import styles from './Counter.module.css'

export function CardSlot() {
  const selectedImage = useSelector((state: RootState) => state.cardSlot.selectedImage)
  const face = useSelector((state: RootState) => state.cardSlot.face)
  const dispatch = useDispatch()

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


  <div style={{opacity: 0}} className="card mpccard">
    <div className="card-header pb-0 text-center">
      <p className="mpccard-slot"></p>
      <button className="padlock">
        <i className="bi bi-unlock"></i>
      </button>
      <button className="remove">
        <i className="bi bi-x-circle"></i>
      </button>
    </div>
    <div className="rounded-lg shadow-lg ratio ratio-7x5">
      <img className="card-img"
           loading="lazy"
           style={{zIndex: 1}}
           // onError={{thumbnail_404(this)}}
      ></img>
      <img className="card-img-prev"
             loading="lazy"
             style={{zIndex: 0}}
             // onError="thumbnail_404(this);"
        ></img>
      <img
          className="card-img-next"
          loading="lazy" style={{zIndex: 0}}
          // onError="thumbnail_404(this);"
      ></img>
    </div>
    <div className="card-body mb-0 text-center">
      <h5 className="card-subtitle mpccard-name"
          contentEditable="true"
          spellCheck="false"
          // onFocus="Library.review.selectElementContents(this)"
      >
      </h5>
      <div className="mpccard-spacing">
        <p className="card-text mpccard-source"></p>
        <p
            className="card-text mpccard-counter"
            // style={{display: "none"}}
        ></p>
        <button
            className="card-text mpccard-counter-btn btn btn-outline-info"
            // style={{display: "none"}}
        ></button>
      </div>
    </div>
    <div
        className="padding-top"
        // style={{paddingTop: 20 + "px"}}
    >
      <button className="prev btn btn-outline-primary">&#10094;</button>
      <button className="next btn btn-outline-primary">&#10095;</button>
    </div>
  </div>
  )
}