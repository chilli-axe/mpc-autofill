import { useRouter } from "next/router";
import React, { useEffect } from "react";

import {
  getLocalStorageBackendURL,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import {
  selectRemoteBackendURL,
  setURL,
  useRemoteBackendConfigured,
} from "@/store/slices/backendSlice";

export const getEnvURL = (): string | undefined => {
  const rawEnvURL = process.env.NEXT_PUBLIC_BACKEND_URL;
  return (rawEnvURL?.length ?? 0) > 0 ? rawEnvURL : undefined; // treat zero-length URL as invalid
};

export function useBackendSetter() {
  const router = useRouter();
  const { server } = router.query;
  const formattedURL: string | null =
    server != null && typeof server == "string" && server.length > 0
      ? standardiseURL(server.trim())
      : null;

  const dispatch = useAppDispatch();
  const backendConfigured = useRemoteBackendConfigured();
  const backendURL = useAppSelector(selectRemoteBackendURL);
  useEffect(() => {
    const envURL = getEnvURL();
    const localStorageBackendURL = getLocalStorageBackendURL();
    if (
      localStorageBackendURL != undefined &&
      backendURL !== localStorageBackendURL
    ) {
      // TODO: stale value here
      dispatch(setURL(localStorageBackendURL));
    } else if (envURL != null && envURL !== localStorageBackendURL) {
      setLocalStorageBackendURL(envURL);
      if (!backendConfigured) {
        dispatch(setURL(envURL));
      }
    } else if (formattedURL != null) {
      dispatch(setURL(formattedURL));
      setLocalStorageBackendURL(formattedURL);
      if (server != null && typeof server == "string" && server.length > 0) {
        // @ts-ignore  // TODO
        router.replace({ server }, undefined, { shallow: true });
      }
    }
  }, [router.isReady, backendConfigured, formattedURL, dispatch, backendURL]);
}
