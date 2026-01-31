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
}: PDFProps) => {
  const { pdfRenderService } = usePDFRenderContext();
  const {
    value: url,
    loading,
    error,
  } = useAsync(async () => {
    return pdfRenderService.renderPDF({
      pageSize,
      bleedEdgeMode,
      includeCutLines,
      cardSpacingMM,
      marginMM,
      cardDocumentsByIdentifier,
      projectMembers,
    });
  }, [
    pageSize,
    bleedEdgeMode,
    includeCutLines,
    cardSpacingMM,
    marginMM,
    cardDocumentsByIdentifier,
    projectMembers,
  ]);

  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url]);
  return { url, loading, error };
};
