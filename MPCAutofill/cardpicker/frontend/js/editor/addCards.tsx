import React from "react";
import Dropdown from "react-bootstrap/Dropdown";
import { AddCardsText } from "./addCardsText";
import { AddCardsURL } from "./addCardsURL";
import { AddCardsXML } from "./addCardsXML";
import { AddCardsCSV } from "./addCardsCSV";

export function AddCards() {
  return (
    <>
      <Dropdown>
        <div className="d-grid gap-0">
          <Dropdown.Toggle variant="success" id="dropdown-basic">
            <i
              className="bi bi-plus-circle"
              style={{ paddingRight: 0.5 + "em" }}
            />{" "}
            Add Cards
          </Dropdown.Toggle>
        </div>
        <Dropdown.Menu>
          <AddCardsText />
          <AddCardsXML />
          <AddCardsCSV />
          <AddCardsURL />
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}
