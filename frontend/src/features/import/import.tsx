import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { ImportCSV } from "./importCSV";
import { ImportText } from "./importText";
import { ImportURL } from "./importURL";
import { ImportXML } from "./importXML";

export function Import() {
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
          <ImportText />
          <ImportXML />
          <ImportCSV />
          <ImportURL />
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}
