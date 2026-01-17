import { useAppDispatch } from "@/common/types";
import { downloadFile, useDoFileDownload } from "@/features/download/download";
import { useLocalFilesContext } from "@/features/localFiles/localFilesContext";
import { LocalFilesService } from "@/features/localFiles/localFilesService";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch } from "@/store/store";

import { useLocalFilesServiceDirectoryHandle } from "../localFiles/localFilesHooks";

async function downloadDesktopTool(
  dispatch: AppDispatch,
  url: URL,
  fileName: string,
  localFilesService: LocalFilesService,
  directoryHandleName?: string
) {
  dispatch(
    setNotification([
      Math.random().toString(),
      {
        name: "Download Started",
        message: `Started downloading the Desktop Tool to ${
          directoryHandleName ?? "Downloads folder"
        }!`,
        level: "info",
      },
    ])
  );
  await downloadFile(undefined, url, fileName, localFilesService);
  dispatch(
    setNotification([
      Math.random().toString(),
      {
        name: "Download Complete",
        message: `Successfully downloaded the Desktop Tool to ${
          directoryHandleName ?? "Downloads folder"
        }!`,
        level: "info",
      },
    ])
  );
  return true;
}

export function useDownloadDesktopTool() {
  const dispatch = useAppDispatch();
  const doFileDownload = useDoFileDownload();
  const { localFilesService } = useLocalFilesContext();
  const directoryHandle = useLocalFilesServiceDirectoryHandle();
  return (url: URL, fileName: string) =>
    doFileDownload(
      "desktop-tool",
      fileName,
      (): Promise<boolean> =>
        downloadDesktopTool(
          dispatch,
          url,
          fileName,
          localFilesService,
          directoryHandle?.name
        )
    );
}
