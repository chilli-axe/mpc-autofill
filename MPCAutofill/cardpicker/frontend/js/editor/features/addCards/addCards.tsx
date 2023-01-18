import React from "react";
import Dropdown from "react-bootstrap/Dropdown";
import { AddCardsByText } from "./addCardsByText";
import { AddCardsByURL } from "./addCardsByURL";
import { AddCardsByXML } from "./addCardsByXML";
import { AddCardsByCSV } from "./addCardsByCSV";

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
          <AddCardsByText />
          <AddCardsByXML />
          <AddCardsByCSV />
          <AddCardsByURL />
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}
