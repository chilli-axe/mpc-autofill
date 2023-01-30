import Button from "react-bootstrap/Button";
import React from "react";
import {
  selectProjectFileSize,
  selectProjectMembers,
  selectProjectSize,
} from "./projectSlice";
import Alert from "react-bootstrap/Alert";
import { bracket, imageSizeToMBString, downloadText } from "../../common/utils";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import { useSelector } from "react-redux";
import { Front, Back } from "../../common/constants";
import formatXML from "xml-formatter";
import { RootState } from "../../app/store";

// TODO: review the codebase for instances of this https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization

export function ProjectStatus() {
  // const [show, setShow] = useState(false);
  // const handleClose = () => setShow(false);
  // const handleShow = () => setShow(true);

  const projectMembers = useSelector(selectProjectMembers);

  const projectSize = useSelector(selectProjectSize);
  const projectBracket = bracket(projectSize);
  const projectFileSize = useSelector(selectProjectFileSize);
  const cardback = useSelector((state: RootState) => state.project.cardback);
  // TODO: this seems inefficient?
  const cardDocuments = useSelector(
    (state: RootState) => state.cardDocuments.cardDocuments
  );

  function generateXML() {
    // TODO: this should be an "output selector" on projectSlice
    interface SlotsByIdentifier {
      [identifier: string]: Set<number>;
    }
    interface OrderMap {
      front: SlotsByIdentifier;
      back: SlotsByIdentifier;
    }

    // aggregate cards in project by face and selected image to a list of slots
    const orderMap: OrderMap = { front: {}, back: {} };
    for (const [slot, projectMember] of projectMembers.entries()) {
      for (const face of [Front, Back]) {
        if (
          projectMember[face].selectedImage != null &&
          projectMember[face].selectedImage !== cardback
        ) {
          if (orderMap[face][projectMember[face].selectedImage] == null) {
            orderMap[face][projectMember[face].selectedImage] = new Set([slot]);
          } else {
            orderMap[face][projectMember[face].selectedImage].add(slot);
          }
        }
      }
    }

    // top level XML doc element, attach everything to this
    const doc = document.implementation.createDocument("", "", null);
    const orderElement = doc.createElement("order");

    // project details
    const detailsElement = doc.createElement("details");

    const quantityElement = doc.createElement("quantity");
    quantityElement.appendChild(doc.createTextNode(projectSize.toString()));
    detailsElement.appendChild(quantityElement);

    const bracketElement = doc.createElement("bracket");
    bracketElement.appendChild(doc.createTextNode(projectBracket.toString()));
    detailsElement.appendChild(bracketElement);

    orderElement.append(detailsElement);

    // project cards
    for (const face of [Front, Back]) {
      if (Object.keys(orderMap[face]).length > 0) {
        const faceElement = doc.createElement(`${face}s`);

        for (const [identifier, slots] of Object.entries(orderMap[face])) {
          const maybeCardDocument = cardDocuments[identifier];
          if (maybeCardDocument != null) {
            const cardElement = doc.createElement("card");

            const identifierElement = doc.createElement("id");
            identifierElement.appendChild(doc.createTextNode(identifier));
            cardElement.appendChild(identifierElement);

            const slotsElement = doc.createElement("slots");
            slotsElement.appendChild(
              doc.createTextNode(
                Array.from(slots)
                  .sort((a, b) => a - b)
                  .toString()
              )
            );
            cardElement.appendChild(slotsElement);

            const nameElement = doc.createElement("name");
            nameElement.appendChild(
              doc.createTextNode(
                `${maybeCardDocument.name}.${maybeCardDocument.extension}`
              )
            );
            cardElement.append(nameElement);

            const queryElement = doc.createElement("query");
            queryElement.appendChild(
              doc.createTextNode(maybeCardDocument.searchq)
            );
            cardElement.append(queryElement);

            faceElement.appendChild(cardElement);
          }
        }
        orderElement.appendChild(faceElement);
      }
    }

    const cardbackElement = doc.createElement("cardback");
    cardbackElement.appendChild(doc.createTextNode(cardback));
    orderElement.appendChild(cardbackElement);

    doc.appendChild(orderElement);

    // serialise to XML and format nicely
    const serialiser = new XMLSerializer();
    const xml = serialiser.serializeToString(doc);

    downloadText(
      "cards.xml",
      formatXML(xml, {
        collapseContent: true,
      })
    ); // TODO: read project name
  }

  return (
    <>
      <h2>Edit MPC Project</h2>
      <Alert variant="secondary">
        Your project contains <b>{projectSize}</b> card
        {projectSize !== 1 && "s"}, belongs in the MPC bracket of up to{" "}
        <b>{projectBracket}</b> cards, and is{" "}
        <b>{imageSizeToMBString(projectFileSize, 0)}</b> in total.
        <br />
        <br />
        <Row>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => <Tooltip {...props}>Save Project</Tooltip>}
              >
                <Button variant="outline-light">
                  <i
                    className="bi bi-device-ssd"
                    style={{ fontSize: 1.25 + "rem" }}
                  />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => <Tooltip {...props}>Download XML</Tooltip>}
              >
                <Button variant="outline-light" onClick={generateXML}>
                  <i
                    className="bi bi-file-earmark-arrow-down"
                    style={{ fontSize: 1.25 + "rem" }}
                  />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => (
                  <Tooltip {...props}>Download Decklist</Tooltip>
                )}
              >
                <Button variant="outline-light">
                  <i
                    className="bi bi-file-text"
                    style={{ fontSize: 1.25 + "rem" }}
                  />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
          <Col xs={3}>
            <div className="d-grid gap-0">
              <OverlayTrigger
                placement="top"
                overlay={(props) => (
                  <Tooltip {...props}>Download Images</Tooltip>
                )}
              >
                <Button variant="outline-light">
                  <i
                    className="bi bi-images"
                    style={{ fontSize: 1.25 + "rem" }}
                  />
                </Button>
              </OverlayTrigger>
            </div>
          </Col>
        </Row>
      </Alert>
    </>
  );
}
