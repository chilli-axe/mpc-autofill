import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { RightPaddedIcon } from "@/components/icon";
import { ExportDecklist } from "@/features/export/exportDecklist";
import { ExportImages } from "@/features/export/exportImages";
import { ExportXML } from "@/features/export/exportXML";

export function Export() {
  return (
    <Dropdown>
      <div className="d-grid gap-0">
        <Dropdown.Toggle variant="secondary" id="dropdown-basic">
          <RightPaddedIcon bootstrapIconName="cloud-arrow-down" /> Download
        </Dropdown.Toggle>
      </div>
      <Dropdown.Menu>
        <ExportXML />
        <ExportImages />
        <ExportDecklist />
      </Dropdown.Menu>
    </Dropdown>
  );
}
