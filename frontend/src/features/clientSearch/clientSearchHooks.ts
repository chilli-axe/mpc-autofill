import { useEffect, useState } from "react";

import { useClientSearchContext } from "./clientSearchContext";

// TODO: these are ripe for refactoring, obviously
export const useLocalFilesDirectoryHandle = ():
  | FileSystemDirectoryHandle
  | undefined => {
  const [directoryHandle, setDirectoryHandle] = useState<
    FileSystemDirectoryHandle | undefined
  >(undefined);
  const { clientSearchService, forceUpdateValue } = useClientSearchContext();
  useEffect(() => {
    clientSearchService.getLocalFilesDirectoryHandle().then(setDirectoryHandle);
  }, [clientSearchService, forceUpdateValue]);
  return directoryHandle;
};

export const useLocalFilesDirectoryIndexSize = (): number | undefined => {
  const [directoryIndexSize, setDirectoryIndexSize] = useState<
    number | undefined
  >(undefined);
  const { clientSearchService, forceUpdateValue } = useClientSearchContext();
  useEffect(() => {
    clientSearchService.getDirectoryIndexSize().then(setDirectoryIndexSize);
  }, [clientSearchService, forceUpdateValue]);
  return directoryIndexSize;
};

export const useHasGoogleDriveIndex = () => {
  const [hasGoogleDriveIndex, setHasGoogleDriveIndex] =
    useState<boolean>(false);
  const { clientSearchService, forceUpdateValue } = useClientSearchContext();
  useEffect(() => {
    clientSearchService.hasGoogleDriveIndex().then(setHasGoogleDriveIndex);
  }, [clientSearchService, forceUpdateValue]);
  return hasGoogleDriveIndex;
};

export const useGoogleDriveIndexSize = (): number | undefined => {
  const [googleDriveIndexSize, setGoogleDriveIndexSize] = useState<
    number | undefined
  >(undefined);
  const { clientSearchService, forceUpdateValue } = useClientSearchContext();
  useEffect(() => {
    clientSearchService.getGoogleDriveIndexSize().then(setGoogleDriveIndexSize);
  }, [clientSearchService, forceUpdateValue]);
  return googleDriveIndexSize;
};
