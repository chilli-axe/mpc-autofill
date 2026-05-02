import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { RightPaddedIcon } from "@/components/icon";
import { ImportCSVButton } from "@/features/import/ImportCSV";
import { ImportLocalFilesButton } from "@/features/import/ImportLocalFiles";
import { ImportTextButton } from "@/features/import/ImportText";
import { ImportURLButton } from "@/features/import/ImportURL";
import { ImportXMLButton } from "@/features/import/ImportXML";

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
          <ImportTextButton />
          <ImportXMLButton />
          <ImportCSVButton />
          <ImportLocalFilesButton />
          <ImportURLButton />
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}
