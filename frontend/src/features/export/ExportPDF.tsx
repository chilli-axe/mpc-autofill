import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { showModal } from "@/store/slices/modalsSlice";
import { selectIsProjectEmpty } from "@/store/slices/projectSlice";

export function ExportPDF() {
  const dispatch = useAppDispatch();
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  const handleClick = () => dispatch(showModal("PDFGenerator"));

  return (
    <Dropdown.Item
      disabled={isProjectEmpty}
      data-testid="export-pdf-button"
      onClick={handleClick}
    >
      <RightPaddedIcon bootstrapIconName="file-pdf" /> PDF
    </Dropdown.Item>
  );
}
