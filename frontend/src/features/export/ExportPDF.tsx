import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { selectIsProjectEmpty } from "@/store/slices/projectSlice";

export function ExportPDF() {
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  return (
    <Dropdown.Item disabled={isProjectEmpty} data-testid="export-pdf-button">
      <RightPaddedIcon bootstrapIconName="file-pdf" /> PDF
    </Dropdown.Item>
  );
}
