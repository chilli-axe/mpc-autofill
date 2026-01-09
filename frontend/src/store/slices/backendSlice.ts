/**
 * State management for the backend that the store should communicate with as configured by the user.
 */

import { ProjectName } from "@/common/constants";
import { BackendState, createAppSlice, useAppSelector } from "@/common/types";
import { useLocalFilesContext } from "@/features/localFiles/localFilesContext";
import { useLocalFilesServiceDirectoryHandle } from "@/features/localFiles/localFilesHooks";
import { useGetBackendInfoQuery } from "@/store/api";
import { RootState } from "@/store/store";

//# region slice configuration

const initialState: BackendState = {
  url: null,
};

export const backendSlice = createAppSlice({
  name: "backend",
  initialState,
  reducers: {
    setURL: (state, action) => {
      state.url = action.payload;
    },
    clearURL: (state) => {
      state.url = null;
    },
  },
});

export const { setURL, clearURL } = backendSlice.actions;
export default backendSlice.reducer;

//# endregion

//# region selectors

export const selectRemoteBackendURL = (state: RootState) => state.backend.url;
export const selectRemoteBackendConfigured = (state: RootState) =>
  selectRemoteBackendURL(state) != null;

//# endregion

//# region hooks

export const useRemoteBackendConfigured = (): boolean => {
  return useAppSelector(selectRemoteBackendConfigured);
};

export const useLocalBackendConfigured = (): boolean => {
  const directoryHandle = useLocalFilesServiceDirectoryHandle();
  return directoryHandle !== undefined;
};

export const useAnyBackendConfigured = (): boolean => {
  const remoteBackendConfigured = useRemoteBackendConfigured();
  const localBackendConfigured = useLocalBackendConfigured();
  return remoteBackendConfigured || localBackendConfigured;
};

export function useProjectName() {
  const backendInfoQuery = useGetBackendInfoQuery();
  return (
    (backendInfoQuery.isSuccess ? backendInfoQuery.data?.name : null) ??
    ProjectName
  );
}

//# endregion
