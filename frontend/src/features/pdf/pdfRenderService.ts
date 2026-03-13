import { Remote, wrap } from "comlink";

import { PDFProps } from "@/features/pdf/PDF";

import type { PDFWorker } from "./pdf.worker";

export class PDFRenderService {
  worker: Remote<PDFWorker> | undefined;
  constructor() {
    this.worker = undefined;
  }

  public initialiseWorker() {
    const worker = new Worker(new URL("./pdf.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker = wrap<PDFWorker>(worker);
  }

  public renderPDF(props: PDFProps): Promise<Blob> {
    if (this.worker === undefined) {
      throw new Error("PDFRenderService was not initialised!");
    }
    return this.worker.renderPDF(props);
  }

  // TODO: awful naming. fix.
  public renderPDFInWorker(props: PDFProps): Promise<string> {
    if (this.worker === undefined) {
      throw new Error("PDFRenderService was not initialised!");
    }
    return this.worker.renderPDFInWorker(props);
  }
}

export const pdfRenderService = new PDFRenderService();
