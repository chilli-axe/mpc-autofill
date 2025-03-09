import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { useDoImageDownload } from "@/features/download/downloadImages";
import { useCardDocumentsByIdentifier } from "@/store/slices/cardDocumentsSlice";
import { selectIsProjectEmpty } from "@/store/slices/projectSlice";
import { setNotification } from "@/store/slices/toastsSlice";

export function ExportImages() {
  const dispatch = useAppDispatch();
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);
  const queueImageDownload = useDoImageDownload();
  const cardDocumentsByIdentifier = useCardDocumentsByIdentifier();
  const downloadImages = async () => {
    Object.values(cardDocumentsByIdentifier).map(queueImageDownload);
    const n = Object.values(cardDocumentsByIdentifier).length;
    dispatch(
      setNotification([
        Math.random().toString(),
        {
          name: "Enqueued Downloads",
          message: `Enqueued ${n} image download${n != 1 ? "s" : ""}!`,
          level: "info",
        },
      ])
    );
  };

  return (
    <Dropdown.Item disabled={isProjectEmpty} onClick={downloadImages}>
      <RightPaddedIcon bootstrapIconName="image" /> Card Images
    </Dropdown.Item>
  );
}
