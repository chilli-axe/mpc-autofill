import { Queue } from "async-await-queue";
import { useRouter } from "next/router";
import { GoogleAnalytics } from "nextjs-google-analytics";
import React, { useEffect } from "react";
import { PropsWithChildren } from "react";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider } from "react-redux";
import styled from "styled-components";

import store from "@/app/store";
import { ContentMaxWidth, NavbarHeight } from "@/common/constants";
import {
  getGoogleAnalyticsConsent,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import { useAppDispatch } from "@/common/types";
import { setURL, useBackendConfigured } from "@/features/backend/backendSlice";
import {
  DownloadContext,
  DownloadContextProvider,
} from "@/features/download/downloadImages";
import { Modals } from "@/features/modals/modals";
import { Toasts } from "@/features/toasts/toasts";
import ProjectNavbar from "@/features/ui/navbar";

function BackendSetter() {
  const router = useRouter();
  const { server } = router.query;
  const formattedURL: string | null =
    server != null && typeof server == "string" && server.length > 0
      ? standardiseURL(server.trim())
      : null;

  const dispatch = useAppDispatch();
  const backendConfigured = useBackendConfigured();
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BACKEND_URL != null) {
      dispatch(setURL(process.env.NEXT_PUBLIC_BACKEND_URL));
      setLocalStorageBackendURL(process.env.NEXT_PUBLIC_BACKEND_URL);
    } else if (formattedURL != null) {
      dispatch(setURL(formattedURL));
      setLocalStorageBackendURL(formattedURL);
      if (server != null && typeof server == "string" && server.length > 0) {
        // @ts-ignore  // TODO
        router.replace({ server }, undefined, { shallow: true });
      }
    }
  }, [router.isReady, backendConfigured, formattedURL, dispatch]);

  return <></>;
}

const OverscrollProvider = styled(Provider)`
  overscroll-behavior: none;
  overflow-x: hidden;
  overflow-y: hidden; // https://stackoverflow.com/a/69589919/13021511
`;

const ContentContainer = styled(Container)`
  top: ${NavbarHeight}px;
  height: calc(
    100vh - ${NavbarHeight}px
  ); // for compatibility with older browsers
  height: calc(100dvh - ${NavbarHeight}px); // handles the ios address bar
  position: fixed;
  overflow-y: scroll;
  overflow-x: hidden;
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

export function LayoutWithoutProvider({ children }: PropsWithChildren) {
  const consent = getGoogleAnalyticsConsent();
  return (
    <>
      {consent === true && (
        <GoogleAnalytics trackPageViews gaMeasurementId="G-JV8WV3FQML" />
      )}
      <Toasts />
      <Modals />
      <BackendSetter />
      <ProjectNavbar />
      {children}
    </>
  );
}

export default function Layout({ children }: PropsWithChildren) {
  const downloadContext: DownloadContext = new Queue(3, 100);
  return (
    <>
      <SSRProvider>
        <OverscrollProvider store={store}>
          <DownloadContextProvider value={downloadContext}>
            <LayoutWithoutProvider>{children}</LayoutWithoutProvider>
          </DownloadContextProvider>
        </OverscrollProvider>
      </SSRProvider>
    </>
  );
}
