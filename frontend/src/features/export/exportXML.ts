/**
 * This module contains functionality for generating an XML representation of the project,
 * suitable for re-uploading into the frontend or uploading to MakePlayingCards
 * through the desktop tool CLI.
 */

import { Back, Front, ReversedCardTypePrefixes } from "@/common/constants";
import { bracket } from "@/common/utils";
import formatXML from "xml-formatter";
import { CardDocuments, SlotProjectMembers } from "@/common/types";

interface SlotsByIdentifier {
  [identifier: string]: Set<number>;
}
interface SlotsByIdentifierAndFace {
  front: SlotsByIdentifier;
  back: SlotsByIdentifier;
}

function aggregateSlotsByIdentifierAndFace(
  projectMembers: Array<SlotProjectMembers>,
  cardback: string | null
): SlotsByIdentifierAndFace {
  /**
   * Aggregate cards in project by (face, selected image) => a list of slots.
   */

  const orderMap: SlotsByIdentifierAndFace = { front: {}, back: {} };
  for (const [slot, projectMember] of projectMembers.entries()) {
    for (const face of [Front, Back]) {
      const projectMemberAtFace = projectMember[face];
      if (projectMemberAtFace != null) {
        const selectedImage = projectMemberAtFace.selectedImage;
        if (selectedImage != null && selectedImage !== cardback) {
          // add to `orderMap`, initialising if necessary
          if (orderMap[face][selectedImage] == null) {
            orderMap[face][selectedImage] = new Set([slot]);
          } else {
            orderMap[face][selectedImage].add(slot);
          }
        }
      }
    }
  }
  return orderMap;
}

function createCardElement(
  cardDocuments: CardDocuments,
  doc: XMLDocument,
  identifier: string,
  slots: Set<number>
): Element | null {
  /**
   * Create an XML element representing the card `identifier`, which is included in the project at `slots`.
   */

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
      doc.createTextNode(
        ReversedCardTypePrefixes[maybeCardDocument.card_type] +
          maybeCardDocument.searchq
      )
    );
    cardElement.append(queryElement);
    return cardElement;
  }
  return null;
}

export function generateXML(
  projectMembers: Array<SlotProjectMembers>,
  cardDocuments: CardDocuments,
  cardback: string | null,
  projectSize: number
): string {
  /**
   * Generate an XML representation of the project, suitable for re-importing into MPC Autofill
   * and suitable for uploading through the desktop tool.
   */

  const orderMap = aggregateSlotsByIdentifierAndFace(projectMembers, cardback);

  // top level XML doc element, attach everything to this
  const doc = document.implementation.createDocument("", "", null);
  const orderElement = doc.createElement("order");

  // project details
  const detailsElement = doc.createElement("details");

  const quantityElement = doc.createElement("quantity");
  quantityElement.appendChild(doc.createTextNode(projectSize.toString()));
  detailsElement.appendChild(quantityElement);

  const bracketElement = doc.createElement("bracket");
  bracketElement.appendChild(
    doc.createTextNode(bracket(projectSize).toString())
  );
  detailsElement.appendChild(bracketElement);

  orderElement.append(detailsElement);

  // project cards
  for (const face of [Front, Back]) {
    if (Object.keys(orderMap[face]).length > 0) {
      const faceElement = doc.createElement(`${face}s`);
      for (const [identifier, slots] of Object.entries(orderMap[face])) {
        const cardElement = createCardElement(
          cardDocuments,
          doc,
          identifier,
          slots
        );
        if (cardElement != null) {
          faceElement.appendChild(cardElement);
        }
      }
      orderElement.appendChild(faceElement);
    }
  }

  // common cardback
  const cardbackElement = doc.createElement("cardback");
  if (cardback != null) {
    cardbackElement.appendChild(doc.createTextNode(cardback));
  }
  orderElement.appendChild(cardbackElement);

  doc.appendChild(orderElement);

  // serialise to XML and format nicely
  const serialiser = new XMLSerializer();
  const xml = serialiser.serializeToString(doc);

  return formatXML(xml, { collapseContent: true });
}
