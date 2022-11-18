import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
// import { decrement, increment } from './cardSlotSlice'
import { RootState } from "./store";
// import styles from './Counter.module.css'
// import { getCard } from "./cardDocumentsSlice";
import { TransitionGroup } from "react-transition-group";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";

interface CardProps {
  identifier: string;
  // TODO: consider how to implement previous/next images
  // we could have 3 instances of this component per slot,
  // or the one instance of this component per slot could manage all 3 images.
}

export function Card(props: CardProps) {
  const [loading, setLoading] = useState(true);
  const [nameEditable, setNameEditable] = useState(false);
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  // const maybeCardDocument = undefined;

  const identifier: string = props.identifier;
  const maybeCardDocument = useSelector(
    (state: RootState) => state.cardDocuments.cardDocuments[identifier]
  );
  // alert(maybeCardDocument === undefined)
  // const maybeCard = useSelector(state => getCard(state, props.identifier));
  if (maybeCardDocument === undefined) {
    return (
      <div>
        <div className="ratio ratio-7x5">
          <div className="d-flex justify-content-center align-items-center">
            <div
              className="spinner-border"
              style={{ width: 4 + "em", height: 4 + "em" }}
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
        <div className="card-body mb-0 text-center">
          <h5 className="card-subtitle mpccard-name" />
          <div className="mpccard-spacing">
            <p className="card-text mpccard-source" />
          </div>
        </div>
      </div>
    );
  } else {
    const cardSmallThumbnailUrl: string = maybeCardDocument.small_thumbnail_url;
    const cardName: string = maybeCardDocument.name;
    const cardSourceVerbose: string = maybeCardDocument.source_verbose;

    return (
      <div>
        <div className="rounded-lg shadow-lg ratio ratio-7x5">
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ display: loading ? "block" : "none" }}
          >
            <div
              className="spinner-border"
              style={{ width: 4 + "em", height: 4 + "em" }}
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>

          {/*<TransitionGroup*/}
          {/*  transitionName="example"*/}
          {/*  transitionEnterTimeout={500}*/}
          {/*  transitionLeaveTimeout={300}>*/}
          <img
            className="card-img"
            loading="lazy"
            style={{ zIndex: 1, opacity: loading ? 0 : 1 }} //  display: loading ? "none" : "block"
            src={cardSmallThumbnailUrl}
            onLoad={() => setLoading(false)}
            onClick={handleShow}
            // onError={{thumbnail_404(this)}}
          />
          {/*</TransitionGroup>*/}
        </div>
        <div className="card-body mb-0 text-center">
          <h5
            className="card-subtitle mpccard-name"
            // contentEditable="true"  // TODO: sort out a better way of managing text input
            // spellCheck="false"
            // onFocus="Library.review.selectElementContents(this)"
          >
            {cardName}
          </h5>
          <div className="mpccard-spacing">
            <p className="card-text mpccard-source">{cardSourceVerbose}</p>
          </div>
        </div>

        <Modal show={show} onHide={handleClose}>
          <Modal.Header closeButton>
            <Modal.Title>test</Modal.Title>
          </Modal.Header>
          <Modal.Body>test</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

// <img className="card-img-prev"
//              loading="lazy"
//              style={{zIndex: 0}}
//              // onError="thumbnail_404(this);"
//         ></img>
//       <img
//           className="card-img-next"
//           loading="lazy" style={{zIndex: 0}}
//           // onError="thumbnail_404(this);"
//       ></img>

// <ReactCSSTransitionGroup
//  transitionName="example"
//  transitionEnterTimeout={500}
//  transitionLeaveTimeout={300}>
//   <img className="card-img"
//       loading="lazy"
//       style={{zIndex: 1, display: loading ? "none" : "block"}}
//       src={cardSmallThumbnailUrl}
//       onLoad={() => setLoading(false)}
//       // onError={{thumbnail_404(this)}}
//  />
// </ReactCSSTransitionGroup>
