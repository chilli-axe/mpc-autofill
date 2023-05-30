import { useRouter } from "next/router";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { useEffect } from "react";
import { PropsWithChildren } from "react";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider, useDispatch, useSelector } from "react-redux";
import styled from "styled-components";

import store from "@/app/store";
import { ContentMaxWidth, NavbarHeight } from "@/common/constants";
import {
  getGoogleAnalyticsConsent,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import { selectBackendURL, setURL } from "@/features/backend/backendSlice";
import { Toasts } from "@/features/toasts/toasts";
import ProjectNavbar from "@/features/ui/navbar";

function BackendSetter() {
  const router = useRouter();
  const { server } = router.query;
  const formattedURL: string | null =
    server != null && typeof server == "string" && server.length > 0
      ? standardiseURL(server.trim())
      : null;

  const dispatch = useDispatch();
  const backendURL = useSelector(selectBackendURL);
  useEffect(() => {
    if (backendURL == null && formattedURL != null) {
      dispatch(setURL(formattedURL));
      setLocalStorageBackendURL(formattedURL);
      if (server != null && typeof server == "string" && server.length > 0) {
        // @ts-ignore  // TODO
        router.replace({ server }, undefined, { shallow: true });
      }
    }
  }, [router.isReady, backendURL, formattedURL, dispatch]);

  return <></>;
}

const OverscrollProvider = styled(Provider)`
  overscroll-behavior: none;
  overflow: hidden; // https://stackoverflow.com/a/69589919/13021511
`;

const ContentContainer = styled(Container)`
  top: ${NavbarHeight}px;
  height: calc(
    100vh - ${NavbarHeight}px
  ); // for compatibility with older browsers
  height: calc(100dvh - ${NavbarHeight}px); // handles the ios address bar
  position: fixed;
  overflow-y: scroll;
  overflow-x: clip;
`;

const MaxWidthContainer = styled(Container)`
  max-width: ${ContentMaxWidth}px;
`;

interface LayoutProps {
  gutter?: number;
}

export default function Layout({
  gutter = 2,
  children,
}: PropsWithChildren<LayoutProps>) {
  const consent = getGoogleAnalyticsConsent();
  return (
    <>
      {consent === true && <GoogleAnalytics trackPageViews />}
      <SSRProvider>
        <OverscrollProvider store={store}>
          <Toasts />
          <BackendSetter />
          <ProjectNavbar />
          <ContentContainer fluid className={`g-${gutter}`}>
            <MaxWidthContainer className={`g-${gutter}`}>
              {children}
            </MaxWidthContainer>
          </ContentContainer>
        </OverscrollProvider>
      </SSRProvider>
    </>
  );
}
