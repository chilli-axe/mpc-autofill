import { useEffect } from "react";
import { useAsync } from "react-use";

import { SourceType } from "@/common/schema_types";
import { pdfRenderService } from "@/features/pdf/pdfRenderService";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";
import { PDFProps } from "./PDF";

export const useRenderPDF = ({
  pageSize,
  bleedEdgeMode,
  includeCutLines,
  cardSpacingMM,
  marginMM,
  cardDocumentsByIdentifier,
  projectMembers,
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
      pageSize,
      bleedEdgeMode,
      includeCutLines,
      cardSpacingMM,
      marginMM,
      cardDocumentsByIdentifier,
      projectMembers,
      imageQuality,
      dpi,
      fileHandles,
    });
  }, [
    pageSize,
    bleedEdgeMode,
    includeCutLines,
    cardSpacingMM,
    marginMM,
    cardDocumentsByIdentifier,
    projectMembers,
    imageQuality,
    dpi,
  ]);

  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url]);
  return { url, loading, error };
};
