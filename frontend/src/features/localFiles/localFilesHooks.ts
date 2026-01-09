import { useEffect, useState } from "react";

import { useLocalFilesContext } from "./localFilesContext";

// TODO: these are ripe for refactoring, obviously
export const useLocalFilesServiceDirectoryHandle = ():
  | FileSystemDirectoryHandle
  | undefined => {
  const [directoryHandle, setDirectoryHandle] = useState<
    FileSystemDirectoryHandle | undefined
  >(undefined);
  const { localFilesService, forceUpdateValue } = useLocalFilesContext();
  useEffect(() => {
    localFilesService.getDirectoryHandle().then(setDirectoryHandle);
  }, [localFilesService, forceUpdateValue]);
  return directoryHandle;
};

export const useLocalFilesServiceDirectoryIndexSize = ():
  | number
  | undefined => {
  const [directoryIndexSize, setDirectoryIndexSize] = useState<
    number | undefined
  >(undefined);
  const { localFilesService, forceUpdateValue } = useLocalFilesContext();
  useEffect(() => {
    localFilesService.getDirectoryIndexSize().then(setDirectoryIndexSize);
  }, [localFilesService, forceUpdateValue]);
  return directoryIndexSize;
};
