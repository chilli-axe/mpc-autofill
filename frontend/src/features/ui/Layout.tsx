import styled from "@emotion/styled";
import { Queue } from "async-await-queue";
import { useRouter } from "next/router";
import { GoogleAnalytics } from "nextjs-google-analytics";
import React, { useEffect, useState } from "react";
import { PropsWithChildren } from "react";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider } from "react-redux";

import { ContentMaxWidth, NavbarHeight } from "@/common/constants";
import {
  getGoogleAnalyticsConsent,
  getLocalStorageBackendURL,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import {
  DownloadContext,
  DownloadContextProvider,
} from "@/features/download/download";
import { LocalFilesContextProvider } from "@/features/localFiles/localFilesContext";
import { localFilesService } from "@/features/localFiles/localFilesService";
import { Modals } from "@/features/modals/Modals";
import { Toasts } from "@/features/toasts/Toasts";
import ProjectNavbar from "@/features/ui/Navbar";
import {
  selectBackendURL,
  setURL,
  useBackendConfigured,
} from "@/store/slices/backendSlice";
import store from "@/store/store";

function BackendSetter() {
  const router = useRouter();
  const { server } = router.query;
  const formattedURL: string | null =
    server != null && typeof server == "string" && server.length > 0
      ? standardiseURL(server.trim())
      : null;

  const dispatch = useAppDispatch();
  const backendConfigured = useBackendConfigured();
  const backendURL = useAppSelector(selectBackendURL);
  useEffect(() => {
    const rawEnvURL = process.env.NEXT_PUBLIC_BACKEND_URL;
    const envURL = (rawEnvURL?.length ?? 0) > 0 ? rawEnvURL : undefined; // treat zero-length URL as invalid
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

  return <></>;
}

const OverscrollProvider = styled(Provider)`
  overscroll-behavior: none;
  overflow-x: hidden;
  overflow-y: hidden; // https://stackoverflow.com/a/69589919/13021511
`;

const ContentContainer = styled(Container)`
  overflow-y: scroll;
  overflow-x: hidden;
  top: ${NavbarHeight}px;
  position: fixed;
  height: calc(
    100vh - ${NavbarHeight}px
  ); // for compatibility with older browsers
  height: calc(100dvh - ${NavbarHeight}px); // handles the ios address bar
`;

const MaxWidthContainer = styled(Container)`
  max-width: ${ContentMaxWidth}px;
`;

interface ProjectContainerProps {
  gutter?: number;
}

export function ProjectContainer({
  gutter = 2,
  children,
}: PropsWithChildren<ProjectContainerProps>) {
  return (
    <ContentContainer fluid className={`g-${gutter}`}>
      <MaxWidthContainer className={`g-${gutter}`}>
        {children}
      </MaxWidthContainer>
    </ContentContainer>
  );
}

export function LayoutWithoutReduxProvider({ children }: PropsWithChildren) {
  const consent = getGoogleAnalyticsConsent();
  const downloadContext: DownloadContext = new Queue(10, 50);
  return (
    <DownloadContextProvider value={downloadContext}>
      <LocalFilesContextProvider value={localFilesService}>
        {consent === true && (
          <GoogleAnalytics trackPageViews gaMeasurementId="G-JV8WV3FQML" />
        )}
        <Toasts />
        <Modals />
        <BackendSetter />
        <ProjectNavbar />
        {children}
      </LocalFilesContextProvider>
    </DownloadContextProvider>
  );
}

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <SSRProvider>
        <OverscrollProvider store={store}>
          <LayoutWithoutReduxProvider>{children}</LayoutWithoutReduxProvider>
        </OverscrollProvider>
      </SSRProvider>
    </>
  );
}
