import {
  createContext,
  DispatchWithoutAction,
  useContext,
  useReducer,
} from "react";

import { LocalFilesService } from "@/features/localFiles/localFilesService";

type LocalFilesContext = {
  localFilesService: LocalFilesService;
  forceUpdate: DispatchWithoutAction;
  forceUpdateValue: number;
};
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
