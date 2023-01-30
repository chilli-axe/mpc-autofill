import { useDispatch } from "react-redux";
import { AppDispatch } from "../../app/store";
import React, { useEffect, useState } from "react";
import { processLines } from "../../common/utils";
import { addImages } from "../project/projectSlice";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { DFCPairs, CardType } from "../../common/types";
import {
  FaceSeparator,
  Card,
  Cardback,
  Token,
  CardTypePrefixes,
  CardTypeSeparator,
} from "../../common/constants";
import { APIGetPlaceholderText } from "../../app/api";

interface AddCardsByTextProps {
  dfcPairs: DFCPairs;
}

export function AddCardsByText(props: AddCardsByTextProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [showTextModal, setShowTextModal] = useState(false);
  const handleCloseTextModal = () => setShowTextModal(false);
  const handleShowTextModal = () => setShowTextModal(true);
  const [textModalValue, setTextModalValue] = useState("");

  const [placeholderText, setPlaceholderText] = useState("");

  const generatePlaceholderText = (placeholders: {
    [cardType: string]: Array<[number, string]>;
  }): string => {
    // const separator = "&#10;";
    const separator = "\n";
    const placeholderTextByCardType: Array<string> = [];
    const reversedCardTypePrefixes = Object.fromEntries(
      Object.keys(CardTypePrefixes).map((prefix: CardType) => [
        CardTypePrefixes[prefix],
        prefix.length > 0 ? prefix + CardTypeSeparator : prefix,
      ])
    );
    for (const cardType of [Card, Token, Cardback]) {
      if (placeholders[cardType] != null) {
        placeholderTextByCardType.push(
          placeholders[cardType]
            .map(
              (x: [number, string]) =>
                `${x[0]}x ${reversedCardTypePrefixes[cardType]}${x[1]}`
            )
            .join(separator)
        );
      }
    }
    return placeholderTextByCardType.join(separator + separator);
  };

  useEffect(() => {
    APIGetPlaceholderText().then((placeholders) =>
      setPlaceholderText(generatePlaceholderText(placeholders))
    );
  }, []);

  // "4x Lion's Eye Diamond&#10;4x Golgari Grave-Troll&#10;4x Bridge from Below&#10;3x Breakthrough&#10;&#10;6x t:Zombie"

  const handleSubmitTextModal = () => {
    /**
     * Parse the contents of the modal and add the resultant queries in the desired numbers of instances to the project.
     */

    const processedLines = processLines(textModalValue, props.dfcPairs);
    dispatch(addImages({ lines: processedLines }));
    handleCloseTextModal();
  };

  return (
    <>
      <Dropdown.Item onClick={handleShowTextModal}>
        <i className="bi bi-card-text" style={{ paddingRight: 0.5 + "em" }} />{" "}
        Text
      </Dropdown.Item>
      <Modal
        show={showTextModal}
        onHide={handleCloseTextModal}
        onExited={() => setTextModalValue("")}
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — Text</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Type the names of the cards you'd like to add to your order and hit{" "}
            <b>Submit</b>. One card per line.
          </p>
          <p>
            Specify both front and back queries by separating them with{" "}
            <code>{FaceSeparator}</code> — for example,{" "}
            <code>4x goblin {FaceSeparator} t:elf</code>.
          </p>
          <p>
            If you don't specify a back query and your front query is a
            double-faced card, we will automatically query the back for you.
          </p>
          <Form.Group className="mb-3">
            <Form.Control
              as="textarea"
              rows={12} // TODO: let's retrieve this placeholder string from the backend
              placeholder={placeholderText}
              required={true}
              onChange={(event) => setTextModalValue(event.target.value)}
              value={textModalValue}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseTextModal}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSubmitTextModal}>
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
