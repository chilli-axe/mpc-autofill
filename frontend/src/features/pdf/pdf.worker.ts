import { expose } from "comlink";

import type { PDFProps } from "./PDF";
let log = console.info;

import { createElement } from "react";

export const renderPDF = async (props: PDFProps) => {
  const { pdf } = await import("@react-pdf/renderer");
  const { PDF } = await import("./PDF");
  // @ts-ignore
  return pdf(createElement(PDF, props)).toBlob();
};

const renderPDFInWorker = async (props: PDFProps) => {
  try {
    // const { renderPDF } = await import('../renderPDF');
    return URL.createObjectURL(await renderPDF(props));
  } catch (error) {
    log(error);
    throw error;
  }
};

const onProgress = (cb: typeof console.info) => (log = cb);

expose({ renderPDF, renderPDFInWorker: renderPDFInWorker, onProgress });
export type PDFWorker = {
  renderPDF: typeof renderPDF;
  renderPDFInWorker: typeof renderPDFInWorker;
  onProgress: typeof onProgress;
};
