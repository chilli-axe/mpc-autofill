/**
 * This component is the XML-based entrypoint for cards into the project editor.
 * Projects which have been previously exported as XML can be re-uploaded through
 * this component and their cards will be added to the current project state.
 * A dropzone is exposed for the user to either drag-and-drop or select their file with.
 * The user will be prompted on whether they want to use their uploaded file's
 * finish settings (e.g. foil/nonfoil, the selected cardstock) or retain the project's
 * finish settings.
 */

import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import {
  Cardback,
  Cardstocks,
  MakePlayingCards,
  MakePlayingCardsURL,
  ProjectMaxSize,
  ProjectName,
  ToggleButtonHeight,
} from "@/common/constants";
import { TextFileDropzone } from "@/common/dropzone";
import { processPrefix } from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { Cardstock, SlotProjectMembers } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import {
  setCardstock,
  setFoil,
} from "@/features/finishSettings/finishSettingsSlice";
import {
  addMembers,
  selectProjectCardback,
  selectProjectSize,
  setSelectedCardback,
} from "@/features/project/projectSlice";

export function ImportXML() {
  const dispatch = useAppDispatch();
  const [showXMLModal, setShowXMLModal] = useState<boolean>(false);
  const handleCloseXMLModal = () => setShowXMLModal(false);
  const handleShowXMLModal = () => setShowXMLModal(true);
  const projectCardback = useAppSelector(selectProjectCardback);
  const projectSize = useAppSelector(selectProjectSize);
  const [useXMLCardback, setUseXMLCardback] = useState<boolean>(false);
  const [useXMLFinishSettings, setUseXMLFinishSettings] =
    useState<boolean>(false);

  const parseXMLFile = (fileContents: string | ArrayBuffer | null) => {
    if (typeof fileContents !== "string") {
      alert("invalid CSV file uploaded");
      // TODO: error messaging to the user that they've uploaded an invalid file
      return;
    }

    // TODO: throw a user-visible error if the xml doc is malformed
    const parser = new DOMParser();
    const xmlDocument = parser.parseFromString(fileContents, "application/xml");
    const rootElement = xmlDocument.getElementsByTagName("order")[0];

    const detailsElement = rootElement.getElementsByTagName("details")[0];
    const stock = detailsElement.getElementsByTagName("stock")[0]?.textContent;
    const foil =
      detailsElement.getElementsByTagName("foil")[0]?.textContent === "true";
    const frontsElement = rootElement.getElementsByTagName("fronts")[0];
    const backsElement = rootElement.getElementsByTagName("backs")[0];

    const frontCardElements = frontsElement.getElementsByTagName("card");
    const backCardElements =
      backsElement != null
        ? backsElement.getElementsByTagName("card")
        : undefined;

    const cardback =
      rootElement.getElementsByTagName("cardback")[0]?.textContent ??
      projectCardback;

    // `newMembers` is initialised with the maximum length it might need to contain all cards
    // the project can hold, then is truncated later according to `lastNonNullSlot`
    let lastNonNullSlot = 0;
    const newMembers: Array<SlotProjectMembers> = Array.from(
      { length: ProjectMaxSize - projectSize },
      () => {
        return { front: null, back: null };
      }
    );

    // it's actually important that we iterate over the backs before the fronts
    // this way, we can determine if each card needs to be given the project cardback or not
    if (backCardElements != null) {
      // TODO: avoid copy/pasting this stuff?
      for (const backCardElement of backCardElements) {
        const slotsText =
          backCardElement.getElementsByTagName("slots")[0]?.textContent;
        if (slotsText == null) {
          continue;
        }
        const searchQuery = processPrefix(
          backCardElement.getElementsByTagName("query")[0].textContent ?? ""
        );
        slotsText
          .split(",")
          .map((slotText) => parseInt(slotText))
          .forEach((slot) => {
            newMembers[slot].back = {
              query: searchQuery,
              selectedImage:
                backCardElement.getElementsByTagName("id")[0].textContent ??
                undefined,
              selected: false,
            };

            lastNonNullSlot = Math.max(lastNonNullSlot, slot);
          });
      }
    }

    for (const frontCardElement of frontCardElements) {
      const slotsText =
        frontCardElement.getElementsByTagName("slots")[0].textContent;
      if (slotsText == null) {
        continue;
      }
      const searchQuery = processPrefix(
        frontCardElement.getElementsByTagName("query")[0].textContent ?? ""
      );

      slotsText
        .split(",")
        .map((slotText) => parseInt(slotText))
        .forEach((slot) => {
          newMembers[slot].front = {
            query: searchQuery,
            selectedImage:
              frontCardElement.getElementsByTagName("id")[0].textContent ??
              undefined,
            selected: false,
          };

          // apply the uploaded XML's cardback if the card doesn't have a matching back
          if (newMembers[slot].back == null) {
            newMembers[slot].back = {
              query: { query: null, card_type: Cardback },
              selectedImage: cardback,
              selected: false,
            };
          }

          lastNonNullSlot = Math.max(lastNonNullSlot, slot);
        });
    }
    dispatch(addMembers({ members: newMembers.slice(0, lastNonNullSlot + 1) }));

    // update project cardback and finish settings according to user's specification
    if (useXMLCardback && cardback != null) {
      dispatch(setSelectedCardback({ selectedImage: cardback }));
    }
    if (
      useXMLFinishSettings &&
      stock != null &&
      Cardstocks.includes(stock as Cardstock) &&
      foil != null
    ) {
      dispatch(setCardstock(stock as Cardstock));
      dispatch(setFoil(foil));
    }

    handleCloseXMLModal();
  };

  return (
    <>
      <Dropdown.Item onClick={handleShowXMLModal}>
        <RightPaddedIcon bootstrapIconName="file-code" /> XML
      </Dropdown.Item>
      <Modal
        show={showXMLModal}
        onHide={handleCloseXMLModal}
        data-testid="import-xml"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — XML</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Upload an XML file of cards to add to the project.</p>
          <p>
            The {ProjectName} website can generate an XML file representing your
            project, and the {ProjectName} desktop tool which auto-fills your
            order into{" "}
            <a href={MakePlayingCardsURL} target="_blank">
              {MakePlayingCards}
            </a>{" "}
            expects a file in this format.
          </p>
          <Toggle
            onClick={() => setUseXMLCardback(!useXMLCardback)}
            on="Use XML Cardback"
            onClassName="flex-centre"
            off="Retain Selected Cardback"
            offClassName="flex-centre"
            onstyle="success"
            offstyle="info"
            width={100 + "%"}
            size="md"
            height={ToggleButtonHeight + "px"}
            active={useXMLCardback}
          />
          <div className="pt-3">
            <Toggle
              onClick={() => setUseXMLFinishSettings(!useXMLFinishSettings)}
              on="Use XML Finish Settings"
              onClassName="flex-centre"
              off="Retain Selected Finish Settings"
              offClassName="flex-centre"
              onstyle="success"
              offstyle="info"
              width={100 + "%"}
              size="md"
              height={ToggleButtonHeight + "px"}
              active={useXMLFinishSettings}
            />
          </div>
          <hr />
          <TextFileDropzone
            mimeTypes={{ "text/xml": [".xml"] }}
            fileUploadCallback={parseXMLFile}
            label="import-xml"
            disabled={false} // this importer has no DFC integration so there's no need to wait for anything
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseXMLModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
