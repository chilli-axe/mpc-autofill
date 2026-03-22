import { createContext, Dispatch, SetStateAction, useContext } from "react";

interface GoogleDrivePickerContextValue {
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
}

const GoogleDrivePickerContext = createContext<
  GoogleDrivePickerContextValue | undefined
>(undefined);

export const GoogleDrivePickerContextProvider =
  GoogleDrivePickerContext.Provider;

export function useGoogleDrivePickerContext(): GoogleDrivePickerContextValue {
  const context = useContext(GoogleDrivePickerContext);
  if (context === undefined) {
    throw new Error(
      "useGoogleDrivePickerContext must be used within a GoogleDrivePickerContextProvider"
    );
  }
  return context;
}
