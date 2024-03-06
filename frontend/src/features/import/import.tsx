import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { RightPaddedIcon } from "@/components/icon";
import { ImportCSV } from "@/features/import/importCSV";
import { ImportText } from "@/features/import/importText";
import { ImportURL } from "@/features/import/importURL";
import { ImportXML } from "@/features/import/importXML";

export function Import() {
  return (
    <>
      <Dropdown>
        <div className="d-grid gap-0">
          <Dropdown.Toggle variant="outline-success" id="dropdown-basic">
            <RightPaddedIcon bootstrapIconName="plus-circle" /> Add Cards
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
