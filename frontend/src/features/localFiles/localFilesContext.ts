import { createContext, useContext } from "react";

import { LocalFilesService } from "@/features/localFiles/localFilesService";

const localFilesContext = createContext<LocalFilesService | undefined>(
  undefined
);
export const LocalFilesContextProvider = localFilesContext.Provider;

export function useLocalFilesContext(): LocalFilesService {
  const context = useContext(localFilesContext);
  if (!context) {
    throw new Error("Attempted to use localFilesContext outside of provider");
  }
  return context;
}
