import { useEffect } from "react";
import { useAsync } from "react-use";

import { PDFProps } from "./PDF";
import { usePDFRenderContext } from "./pdfRenderContext";

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
}: PDFProps) => {
  const { pdfRenderService } = usePDFRenderContext();
  const {
    value: url,
    loading,
    error,
  } = useAsync(async () => {
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
