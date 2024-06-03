import React, { createContext, useContext } from "react";

export type LocalFilesContext = [
  File[],
  React.Dispatch<React.SetStateAction<File[]>>
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
