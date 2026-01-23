import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { SourceType } from "@/common/schema_types";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { useDoImageDownload } from "@/features/download/downloadImages";
import { useCardDocumentsByIdentifier } from "@/store/slices/cardDocumentsSlice";
import { selectAnyImagesDownloadable } from "@/store/slices/projectSlice";
import { setNotification } from "@/store/slices/toastsSlice";

export function ExportImages() {
  const dispatch = useAppDispatch();
  const anyImagesDownloadable = useAppSelector(selectAnyImagesDownloadable);
  const queueImageDownload = useDoImageDownload();
  const cardDocumentsByIdentifier = useCardDocumentsByIdentifier();
  const downloadImages = async () => {
    const cardDocuments = Object.values(cardDocumentsByIdentifier).filter(
      (cardDocument) => cardDocument.sourceType === SourceType.GoogleDrive
    );
    cardDocuments.map(queueImageDownload);
    const n = cardDocuments.length;
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
    <Dropdown.Item disabled={!anyImagesDownloadable} onClick={downloadImages}>
      <RightPaddedIcon bootstrapIconName="image" /> Card Images
    </Dropdown.Item>
  );
}
