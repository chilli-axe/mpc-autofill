import { createContext, useContext } from "react";

import { PDFRenderService } from "@/features/pdf/pdfRenderService";

type PDFRenderContext = {
  pdfRenderService: PDFRenderService;
};
const pdfRenderContext = createContext<PDFRenderContext | undefined>(undefined);
export const PDFRenderContextProvider = pdfRenderContext.Provider;

export function usePDFRenderContext(): PDFRenderContext {
  const context = useContext(pdfRenderContext);
  if (!context) {
    throw new Error("Attempted to use pdfRenderContext outside of provider");
  }
  return context;
}
