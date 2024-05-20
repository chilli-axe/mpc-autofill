import { Queue } from "async-await-queue";
import { saveAs } from "file-saver";
import { createContext, useContext } from "react";

import { api } from "@/app/api";
import { base64StringToBlob } from "@/common/processing";
import { CardDocument, useAppDispatch } from "@/common/types";
import { setNotification } from "@/features/toasts/toastsSlice";

export type DownloadContext = Queue;

const downloadContext = createContext<DownloadContext | undefined>(undefined);
export const DownloadContextProvider = downloadContext.Provider;

export function useDownloadContext(): DownloadContext {
  const context = useContext(downloadContext);
  if (!context) {
    throw new Error("Attempted to use downloadContext outside of provider");
  }
  return context;
}

export function useQueueImageDownload(): (
  cardDocument: CardDocument
) => Promise<void> {
  const dispatch = useAppDispatch();
  // TODO: this function will need to be updated when we update the frontend to support multiple image repo backends
  const [triggerFn, getGoogleDriveImageQuery] =
    api.endpoints.getGoogleDriveImage.useLazyQuery();
  const queue = useDownloadContext();

  return (cardDocument) => {
    const me = Symbol();
    return queue
      .wait(me, -1)
      .then(async () => {
        const response = await triggerFn(cardDocument.identifier);
        const data = response.data;
        if (data != null) {
          saveAs(
            base64StringToBlob(data),
            `${cardDocument.name} (${cardDocument.identifier}).${cardDocument.extension}`
          );
        }
      })
      .catch((e) => {
        dispatch(
          setNotification([
            `download-${cardDocument.identifier}-failed`,
            {
              name: `Failed to download ${cardDocument.name} (${cardDocument.identifier})`,
              message: e.toString(),
              level: "error",
            },
          ])
        );
      })
      .finally(() => queue.end(me));
  };
}
