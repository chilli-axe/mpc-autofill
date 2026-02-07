import { useEffect } from "react";
import { useAsync } from "react-use";

import { pdfRenderService } from "@/features/pdf/pdfRenderService";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";
import { PDFProps } from "./PDF";

export const useRenderPDF = ({
  cardSelectionMode,
  pageSize,
  bleedEdgeMM,
  roundCorners,
  cardSpacingMM,
  marginMM,
  cardDocumentsByIdentifier,
  projectMembers,
  projectCardback,
  imageQuality,
}: Omit<PDFProps, "fileHandles">) => {
  const { clientSearchService } = useClientSearchContext();
  const {
    value: url,
    loading,
    error,
  } = useAsync(async () => {
    const fileHandles = await clientSearchService.getFileHandlesByIdentifier(
      cardDocumentsByIdentifier
    );
    return pdfRenderService.renderPDFInWorker({
      cardSelectionMode,
      pageSize,
      bleedEdgeMM,
      roundCorners,
      cardSpacingMM,
      marginMM,
      cardDocumentsByIdentifier,
      projectMembers,
      projectCardback,
      imageQuality,
      fileHandles,
    });
  }, [
    cardSelectionMode,
    pageSize,
    bleedEdgeMM,
    roundCorners,
    cardSpacingMM,
    marginMM,
    cardDocumentsByIdentifier,
    projectMembers,
    projectCardback,
    imageQuality,
  ]);

  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url]);
  return { url, loading, error };
};
