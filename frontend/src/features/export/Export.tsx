import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { RightPaddedIcon } from "@/components/icon";
import { ExportDecklist } from "@/features/export/ExportDecklist";
import { ExportImages } from "@/features/export/ExportImages";
import { ExportXML } from "@/features/export/ExportXML";

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
