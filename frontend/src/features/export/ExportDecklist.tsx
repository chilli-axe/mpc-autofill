import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { useDownloadDecklist } from "@/features/download/downloadDecklist";
import { selectIsProjectEmpty } from "@/store/slices/projectSlice";

export function ExportDecklist() {
  //# region queries and hooks

  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);
  const downloadDecklist = useDownloadDecklist();

  //# endregion

  return (
    <Dropdown.Item
      disabled={isProjectEmpty}
      onClick={downloadDecklist}
      data-testid="export-decklist-button"
    >
      <RightPaddedIcon bootstrapIconName="card-text" /> Decklist
    </Dropdown.Item>
  );
}
