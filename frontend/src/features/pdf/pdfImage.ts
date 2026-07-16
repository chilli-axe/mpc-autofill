import { getBucketImageURL, getWorkerImageURL } from "@/common/image";
import { SourceType } from "@/common/schema_types";
import { CardDocument } from "@/common/types";

export type PDFImageQuality =
  | "small-thumbnail"
  | "large-thumbnail"
  | "full-resolution";

/**
 * Resolve the image source for a card in a PDF, honouring the requested quality
 * tier and the card's source (Google Drive bucket/worker, or a local file).
 * Shared by the standard PDF render path and the SCM render path.
 */
export const getPDFImageURL = async (
  cardDocument: CardDocument,
  imageQuality: PDFImageQuality,
  dpi: number | undefined,
  jpgQuality: number,
  fileHandles: { [identifier: string]: FileSystemFileHandle }
): Promise<string | Blob | undefined> => {
  switch (cardDocument.sourceType) {
    case SourceType.GoogleDrive:
      switch (imageQuality) {
        case "small-thumbnail":
          return getBucketImageURL(cardDocument, "small");
        case "large-thumbnail":
          return getBucketImageURL(cardDocument, "large");
        case "full-resolution":
          return getWorkerImageURL(cardDocument, "full", dpi, jpgQuality);
        default:
          throw new Error(`invalid imageQuality ${imageQuality}`);
      }

    case SourceType.LocalFile:
      const handle = fileHandles[cardDocument.identifier];
      if (handle !== undefined) {
        return URL.createObjectURL(await handle.getFile());
      } else {
        throw new Error(
          `could not get handle for file ${cardDocument.identifier}`
        );
      }
    default:
      throw new Error(
        `cannot get PDF thumbnail URL for card ${cardDocument.identifier}`
      );
  }
};
