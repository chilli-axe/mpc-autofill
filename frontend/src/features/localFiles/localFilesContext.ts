import React, { createContext, useContext } from "react";

import { DirectoryIndex } from "@/common/types";

export type LocalFilesContext = [
  DirectoryIndex | null,
  React.Dispatch<React.SetStateAction<DirectoryIndex | null>>
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
