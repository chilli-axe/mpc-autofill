import { base64StringToBlob } from "@/common/processing";
import { CardDocument, useAppSelector } from "@/common/types";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import { downloadFile, useDoFileDownload } from "@/features/download/download";
import { api } from "@/store/api";

export function useDoImageDownload(): (
  cardDocument: CardDocument
) => Promise<void> {
  const doFileDownload = useDoFileDownload();
  // TODO: this function will need to be updated when we update the frontend to support multiple image repo backends
  const [triggerFn, getGoogleDriveImageQuery] =
    api.endpoints.getGoogleDriveImage.useLazyQuery();
  const { clientSearchService } = useClientSearchContext();

  async function doImageDownload(cardDocument: CardDocument): Promise<boolean> {
    try {
      const response = await triggerFn(cardDocument.identifier);
      const data = response.data;
      if (data != null) {
        await downloadFile(
          base64StringToBlob(data),
          undefined,
          `${cardDocument.name} (${cardDocument.identifier}).${cardDocument.extension}`,
          clientSearchService
        );
      } else {
        return Promise.reject(
          `Failed to download ${cardDocument.name} (${cardDocument.identifier})`
        );
      }
      return true;
    } catch (e) {
      return Promise.reject(
        `Failed to download ${cardDocument.name} (${cardDocument.identifier})`
      );
    }
  }

  return (cardDocument) =>
    doFileDownload("image", cardDocument.name, () =>
      doImageDownload(cardDocument)
    );
}
