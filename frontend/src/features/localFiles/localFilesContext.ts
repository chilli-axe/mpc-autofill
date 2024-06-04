import React, { createContext, useContext } from "react";

import { DirectoryIndex } from "@/common/types";

export type LocalFilesContext = [
  Array<DirectoryIndex>,
  React.Dispatch<React.SetStateAction<Array<DirectoryIndex>>>
];

const localFilesContext = createContext<LocalFilesContext | undefined>(
  undefined
);
export const LocalFilesContextProvider = localFilesContext.Provider;

export function useLocalFilesContext(): LocalFilesContext {
  const context = useContext(localFilesContext);
  if (!context) {
    throw new Error("Attempted to use localFilesContext outside of provider");
  }
  return context;
}
