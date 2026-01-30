import { createContext, DispatchWithoutAction, useContext } from "react";

import { ClientSearchService } from "@/features/clientSearch/clientSearchService";

type ClientSearchContext = {
  clientSearchService: ClientSearchService;
  forceUpdate: DispatchWithoutAction;
  forceUpdateValue: number;
};
const clientSearchContext = createContext<ClientSearchContext | undefined>(
  undefined
);
export const ClientSearchContextProvider = clientSearchContext.Provider;

export function useClientSearchContext(): ClientSearchContext {
  const context = useContext(clientSearchContext);
  if (!context) {
    throw new Error("Attempted to use clientSearchContext outside of provider");
  }
  return context;
}
