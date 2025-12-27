import { Queue } from "async-await-queue";
import { saveAs } from "file-saver";
import { createContext, useContext } from "react";

import { FileDownloadType, useAppDispatch } from "@/common/types";
import { LocalFilesService } from "@/features/localFiles/localFilesService";
import {
  enqueueDownload,
  startDownload,
  stopDownload,
} from "@/store/slices/fileDownloadsSlice";
import { setNotification } from "@/store/slices/toastsSlice";

export type DownloadContext = Queue<symbol>;

const downloadContext = createContext<DownloadContext | undefined>(undefined);
export const DownloadContextProvider = downloadContext.Provider;

export function useDownloadContext(): DownloadContext {
  const context = useContext(downloadContext);
  if (!context) {
    throw new Error("Attempted to use downloadContext outside of provider");
  }
  return context;
}

export const downloadFile = async (
  fileContents: any,
  fileName: string,
  localFilesService: LocalFilesService
) => {
  if (localFilesService.getDirectoryHandle() !== undefined) {
    const fileHandle = await localFilesService
      .getDirectoryHandle()!
      .getFileHandle(fileName, {
        create: true,
      });
    const writable = await fileHandle.createWritable();
    await writable.write(fileContents);
    await writable.close();
  } else {
    saveAs(fileContents, fileName);
  }
};

/**
 * This hook returns a function you can call to wrap file downloading functions.
 * Wrapping the function like this hooks your download into the download manager system.
 * When calling the returned function, you need to specify:
 *   1. The type of file you're downloading (so we can show the appropriate icon)
 *   2. The name of the file you're downloading
 *   3. An async function which accepts no arguments and does the actual downloading work,
 *      resolving to a boolean indicating whether the download was a success.
 */
export function useDoFileDownload(): (
  type: FileDownloadType,
  name: string,
  callable: () => Promise<boolean>
) => Promise<void> {
  const queue = useDownloadContext();
  const dispatch = useAppDispatch();
  return (type, name, callable) => {
    const downloadId = Math.random().toString();
    const jobHash = Symbol.for(downloadId);
    dispatch(
      enqueueDownload({
        id: downloadId,
        type,
        name,
        enqueuedTimestamp: new Date().toString(),
      })
    );
    return queue
      .wait(jobHash, -1)
      .then(async () => {
        dispatch(
          startDownload({
            id: downloadId,
            startedTimestamp: new Date().toString(),
          })
        );
        return await callable();
      })
      .catch((reason) => {
        dispatch(
          setNotification([
            `download-${downloadId}-failed`,
            {
              name: `Download Failed`,
              message: reason.toString(),
              level: "error",
            },
          ])
        );
        return false;
      })
      .then((isSuccess) => {
        dispatch(
          stopDownload({
            id: downloadId,
            status: isSuccess ? "success" : "failed",
            completedTimestamp: new Date().toString(),
          })
        );
      })
      .finally(() => queue.end(jobHash));
  };
}

export function useTerminateQueuedDownloads() {
  const queue = useDownloadContext();
  const dispatch = useAppDispatch();
  return () => {
    while (queue.queueWaiting.size() > 0) {
      // pop the next job out of the queue
      const job = queue.queueWaiting.pop();
      // mark it as complete in redux
      if (job !== undefined) {
        const downloadId = Symbol.keyFor(job.hash);
        if (downloadId !== undefined) {
          dispatch(
            stopDownload({
              id: downloadId,
              status: "terminated",
              completedTimestamp: new Date().toString(),
            })
          );
        }
      }
    }
  };
}
