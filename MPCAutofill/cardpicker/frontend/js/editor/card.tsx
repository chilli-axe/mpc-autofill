import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
// import { decrement, increment } from './cardSlotSlice'
import { RootState } from "./store";
// import styles from './Counter.module.css'
// import { getCard } from "./cardDocumentsSlice";
import { TransitionGroup } from "react-transition-group";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";
import { imageSizeToMBString } from "./utils";

interface CardProps {
  identifier: string;
  // TODO: consider how to implement previous/next images
  // we could have 3 instances of this component per slot,
  // or the one instance of this component per slot could manage all 3 images.
}

export function Card(props: CardProps) {
  const [smallThumbnailLoading, setSmallThumbnailLoading] = useState(true);
  const [mediumThumbnailLoading, setMediumThumbnailLoading] = useState(true);
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
    return (
      <div>
        <div className="rounded-lg shadow-lg ratio ratio-7x5">
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ display: smallThumbnailLoading ? "block" : "none" }}
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
            style={{ zIndex: 1, opacity: smallThumbnailLoading ? 0 : 1 }}
            src={maybeCardDocument.small_thumbnail_url}
            onLoad={() => setSmallThumbnailLoading(false)}
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
            {maybeCardDocument.name}
          </h5>
          <div className="mpccard-spacing">
            <p className="card-text mpccard-source">
              {maybeCardDocument.source_verbose}
            </p>
          </div>
        </div>

        <Modal show={show} onHide={handleClose} size={"xl"}>
          <Modal.Header closeButton>
            <Modal.Title>Card Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <div
                className="col-lg-5 mb-3 mb-lg-0"
                style={{ position: "relative" }}
              >
                {/*  <div className="shadow-lg ratio ratio-7x5"*/}
                {/*  // style="border-radius: 18px"*/}
                {/*  >*/}
                {/*    <img*/}
                {/*      className="card-img"*/}
                {/*      loading="lazy"*/}
                {/*      style={{ zIndex: 1, opacity: mediumThumbnailLoading ? 0 : 1 }}*/}
                {/*      src={cardMediumThumbnailUrl}*/}
                {/*      onLoad={() => setMediumThumbnailLoading(false)}*/}
                {/*      // onError={{thumbnail_404(this)}}*/}
                {/*    />*/}
                {/*  </div>*/}
                <div className="rounded-xl shadow-lg ratio ratio-7x5">
                  <div
                    className="d-flex justify-content-center align-items-center"
                    style={{
                      display: mediumThumbnailLoading ? "block" : "none",
                    }}
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
                    style={{
                      zIndex: 1,
                      opacity: mediumThumbnailLoading ? 0 : 1,
                    }}
                    src={maybeCardDocument.medium_thumbnail_url}
                    onLoad={() => setMediumThumbnailLoading(false)}
                    // onError={{thumbnail_404(this)}}
                  />
                  {/*</TransitionGroup>*/}
                </div>
              </div>
              <div className="col-lg-7">
                <h4>{maybeCardDocument.name}</h4>
                <Table hover>
                  <tbody>
                    <tr>
                      <td>
                        <b>Source Name</b>
                      </td>
                      <td>{maybeCardDocument.source}</td>
                    </tr>
                    <tr>
                      <td>
                        <b>Source Type</b>
                      </td>
                      <td>{maybeCardDocument.source_type}</td>
                    </tr>
                    <tr>
                      <td>
                        <b>Class</b>
                      </td>
                      <td>
                        {maybeCardDocument.card_type.charAt(0).toUpperCase() +
                          maybeCardDocument.card_type.slice(1).toLowerCase()}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Identifier</b>
                      </td>
                      <td>
                        <code>{maybeCardDocument.identifier}</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Resolution</b>
                      </td>
                      <td>{maybeCardDocument.dpi} DPI</td>
                    </tr>
                    <tr>
                      <td>
                        <b>Date Created</b>
                      </td>
                      <td>{maybeCardDocument.date}</td>
                    </tr>
                    <tr>
                      <td>
                        <b>File Size</b>
                      </td>
                      <td>{imageSizeToMBString(maybeCardDocument.size, 2)}</td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </Row>
          </Modal.Body>
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
