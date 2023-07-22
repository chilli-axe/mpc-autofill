import { useRouter } from "next/router";
import { GoogleAnalytics } from "nextjs-google-analytics";
import React, { useEffect } from "react";
import { PropsWithChildren } from "react";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider } from "react-redux";
import styled from "styled-components";

import store, { RootState } from "@/app/store";
import { ContentMaxWidth, NavbarHeight } from "@/common/constants";
import {
  getGoogleAnalyticsConsent,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { setURL, useBackendConfigured } from "@/features/backend/backendSlice";
import { MemoizedCardDetailedView } from "@/features/card/cardDetailedView";
import { Toasts } from "@/features/toasts/toasts";
import { hideModal } from "@/features/ui/modalSlice";
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
    if (!backendConfigured && formattedURL != null) {
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

function Modals() {
  // TODO: move the grid selector into here
  // TODO: move the developer and patreon support modals into here
  const [selectedImage, shownModal] = useAppSelector((state: RootState) => [
    state.modal.card,
    state.modal.shownModal,
  ]);
  const dispatch = useAppDispatch();
  return (
    <>
      {selectedImage != null && (
        <MemoizedCardDetailedView
          cardDocument={selectedImage}
          show={shownModal === "cardDetailedView"}
          handleClose={() => dispatch(hideModal())}
        />
      )}
    </>
  );
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
      {consent === true && <GoogleAnalytics trackPageViews />}
      <Toasts />
      <Modals />
      <BackendSetter />
      <ProjectNavbar />
      {children}
    </>
  );
}

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <SSRProvider>
        <OverscrollProvider store={store}>
          <LayoutWithoutProvider>{children}</LayoutWithoutProvider>
        </OverscrollProvider>
      </SSRProvider>
    </>
  );
}
