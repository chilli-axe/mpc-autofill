import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { useDownloadXML } from "@/features/download/downloadXML";
import { selectIsProjectEmpty } from "@/store/slices/projectSlice";

export function ExportXML() {
  const exportXML = useDownloadXML();
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  return (
    <Dropdown.Item
      disabled={isProjectEmpty}
      onClick={exportXML}
      data-testid="export-xml-button"
    >
      <RightPaddedIcon bootstrapIconName="file-code" /> XML
    </Dropdown.Item>
  );
}
