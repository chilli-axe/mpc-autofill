import { useAppDispatch } from "@/common/types";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import { ClientSearchService } from "@/features/clientSearch/clientSearchService";
import { downloadFile, useDoFileDownload } from "@/features/download/download";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch } from "@/store/store";

import { useLocalFilesDirectoryHandle } from "../clientSearch/clientSearchHooks";

async function downloadDesktopTool(
  dispatch: AppDispatch,
  url: URL,
  fileName: string,
  clientSearchService: ClientSearchService,
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
  await downloadFile(undefined, url, fileName, clientSearchService);
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
  const { clientSearchService } = useClientSearchContext();
  const directoryHandle = useLocalFilesDirectoryHandle();
  return (url: URL, fileName: string) =>
    doFileDownload(
      "desktop-tool",
      fileName,
      (): Promise<boolean> =>
        downloadDesktopTool(
          dispatch,
          url,
          fileName,
          clientSearchService,
          directoryHandle?.name
        )
    );
}
