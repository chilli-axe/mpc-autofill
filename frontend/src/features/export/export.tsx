import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { ExportDecklist } from "@/features/export/exportDecklist";
import { ExportImages } from "@/features/export/exportImages";
import { ExportXML } from "@/features/export/exportXML";

export function Export() {
  return (
    <>
      <Dropdown>
        <div className="d-grid gap-0">
          <Dropdown.Toggle variant="success" id="dropdown-basic">
            <i
              className="bi bi-cloud-arrow-down"
              style={{ paddingRight: 0.5 + "em" }}
            />{" "}
            Download
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
