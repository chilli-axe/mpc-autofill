/**
 * This module contains functionality for generating an XML representation of the project,
 * suitable for re-uploading into the frontend or uploading to MakePlayingCards
 * through the desktop tool CLI.
 */

import formatXML from "xml-formatter";

import { Back, Front, ReversedCardTypePrefixes } from "@/common/constants";
import { useAppStore } from "@/common/types";
import {
  CardDocuments,
  FinishSettingsState,
  SlotProjectMembers,
} from "@/common/types";
import { bracket } from "@/common/utils";
import { downloadFile, useDoFileDownload } from "@/features/download/download";
import { useLocalFilesContext } from "@/features/localFiles/localFilesContext";
import { LocalFilesService } from "@/features/localFiles/localFilesService";
import { selectFinishSettings } from "@/store/slices/finishSettingsSlice";
import {
  selectProjectMembers,
  selectProjectSize,
} from "@/store/slices/projectSlice";
import { RootState } from "@/store/store";

interface SlotsByIdentifier {
  [identifier: string]: Set<number>;
}
interface SlotsByIdentifierAndFace {
  front: SlotsByIdentifier;
  back: SlotsByIdentifier;
}

/**
 * Aggregate cards in project by (face, selected image) => a list of slots.
 */
function aggregateSlotsByIdentifierAndFace(
  projectMembers: Array<SlotProjectMembers>,
  cardback: string | null
): SlotsByIdentifierAndFace {
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

/**
 * Create an XML element representing the card `identifier`, which is included in the project at `slots`.
 */
function createCardElement(
  cardDocuments: CardDocuments,
  doc: XMLDocument,
  identifier: string,
  slots: Set<number>
): Element | null {
  const maybeCardDocument = cardDocuments[identifier];
  if (maybeCardDocument == null) {
    return null;
  }
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
      ReversedCardTypePrefixes[maybeCardDocument.cardType] +
        maybeCardDocument.searchq
    )
  );
  cardElement.append(queryElement);
  return cardElement;
}

const selectGeneratedXML = (state: RootState): string => {
  return generateXML(
    selectProjectMembers(state),
    state.cardDocuments.cardDocuments,
    state.project.cardback,
    selectProjectSize(state),
    selectFinishSettings(state)
  );
};

/**
 * Generate an XML representation of the project, suitable for re-importing into MPC Autofill
 * and suitable for uploading through the desktop tool.
 */
export function generateXML(
  projectMembers: Array<SlotProjectMembers>,
  cardDocuments: CardDocuments,
  cardback: string | null,
  projectSize: number,
  finishSettings: FinishSettingsState
): string {
  const orderMap = aggregateSlotsByIdentifierAndFace(projectMembers, cardback);

  // top level XML doc element, attach everything to this
  const doc = document.implementation.createDocument("", "", null);
  const orderElement = doc.createElement("order");

  // project details
  const detailsElement = doc.createElement("details");

  const quantityElement = doc.createElement("quantity");
  quantityElement.appendChild(doc.createTextNode(projectSize.toString()));
  detailsElement.appendChild(quantityElement);

  // TODO: the `bracket` field should be safe to remove by 2024-07-01
  //       this commit updates the desktop tool to no longer read it, but i want to ensure
  //       there's minimal risk of users trying to use XMLs without the field with versions
  //       of the desktop tool that expect it.
  const bracketElement = doc.createElement("bracket");
  bracketElement.appendChild(
    doc.createTextNode(bracket(projectSize).toString())
  );
  detailsElement.appendChild(bracketElement);

  const stockElement = doc.createElement("stock");
  stockElement.appendChild(doc.createTextNode(finishSettings.cardstock));
  detailsElement.appendChild(stockElement);

  const foilElement = doc.createElement("foil");
  foilElement.appendChild(
    doc.createTextNode(finishSettings.foil ? "true" : "false")
  );
  detailsElement.appendChild(foilElement);

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
        const cardIsProjectCardback = identifier === cardback && face === Back;
        if (cardElement != null && !cardIsProjectCardback) {
          faceElement.appendChild(cardElement);
        }
      }
      if (faceElement.children.length > 0) {
        orderElement.appendChild(faceElement);
      }
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

async function downloadXML(
  state: RootState,
  localFilesService: LocalFilesService
) {
  const generatedXML = selectGeneratedXML(state);
  await downloadFile(
    new Blob([generatedXML], { type: "text/xml;charset=utf-8" }),
    "cards.xml",
    localFilesService
  );
  return true;
}

export function useDownloadXML() {
  const store = useAppStore();
  const doFileDownload = useDoFileDownload();
  const localFilesService = useLocalFilesContext();
  return () =>
    Promise.resolve(
      doFileDownload(
        "xml",
        "cards.xml",
        (): Promise<boolean> => downloadXML(store.getState(), localFilesService)
      )
    );
}
