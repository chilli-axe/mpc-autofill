import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { ExportDecklist } from "@/features/export/exportDecklist";
import { ExportImages } from "@/features/export/exportImages";
import { ExportXML } from "@/features/export/exportXML";
import { RightPaddedIcon } from "@/features/ui/styledComponents";

export function Export() {
  return (
    <>
      <Dropdown>
        <div className="d-grid gap-0">
          <Dropdown.Toggle variant="success" id="dropdown-basic">
            <RightPaddedIcon bootstrapIconName="cloud-arrow-down" /> Download
          </Dropdown.Toggle>
        </div>
        <Dropdown.Menu>
          <ExportDecklist />
          <ExportXML />
          <ExportImages />
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}
