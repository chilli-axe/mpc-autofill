import React, { useEffect, useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import { ImportText } from "./importText";
import { ImportURL } from "./importURL";
import { ImportXML } from "./importXML";
import { ImportCSV } from "./importCSV";
import { APIGetDFCPairs } from "@/app/api";
import { DFCPairs } from "@/common/types";
import { processQuery } from "@/common/processing";

export function Import() {
  const [dfcPairs, setDFCPairs] = useState<DFCPairs>({});

  useEffect(() => {
    APIGetDFCPairs().then((pairs) =>
      setDFCPairs(
        Object.fromEntries(
          Object.keys(pairs).map((front) => [
            processQuery(front),
            processQuery(pairs[front]),
          ])
        )
      )
    );
  }, []);

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
          <ImportText dfcPairs={dfcPairs} />
          <ImportXML />
          <ImportCSV dfcPairs={dfcPairs} />
          <ImportURL dfcPairs={dfcPairs} />
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}
