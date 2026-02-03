import { useEffect } from "react";
import { useAsync } from "react-use";

import { pdfRenderService } from "@/features/pdf/pdfRenderService";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";
import { PDFProps } from "./PDF";

export const useRenderPDF = ({
  cardSelectionMode,
  pageSize,
  bleedEdgeMode,
  cardSpacingMM,
  marginMM,
  cardDocumentsByIdentifier,
  projectMembers,
  projectCardback,
  imageQuality,
  dpi,
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
      bleedEdgeMode,
      cardSpacingMM,
      marginMM,
      cardDocumentsByIdentifier,
      projectMembers,
      projectCardback,
      imageQuality,
      dpi,
      fileHandles,
    });
  }, [
    cardSelectionMode,
    pageSize,
    bleedEdgeMode,
    cardSpacingMM,
    marginMM,
    cardDocumentsByIdentifier,
    projectMembers,
    projectCardback,
    imageQuality,
    dpi,
  ]);

  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url]);
  return { url, loading, error };
};
