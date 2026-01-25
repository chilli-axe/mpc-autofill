import styled from "@emotion/styled";
import { Queue } from "async-await-queue";
import { GoogleAnalytics } from "nextjs-google-analytics";
import React, { useEffect, useReducer } from "react";
import { PropsWithChildren } from "react";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider } from "react-redux";

import { ContentMaxWidth, NavbarHeight } from "@/common/constants";
import {
  getGoogleAnalyticsConsent,
  getLocalStorageFavorites,
} from "@/common/cookies";
import { useAppDispatch } from "@/common/types";
import { useBackendSetter } from "@/features/backend/useBackendSetter";
import {
  DownloadContext,
  DownloadContextProvider,
} from "@/features/download/download";
import { LocalFilesContextProvider } from "@/features/localFiles/localFilesContext";
import { localFilesService } from "@/features/localFiles/localFilesService";
import { Modals } from "@/features/modals/Modals";
import { Toasts } from "@/features/toasts/Toasts";
import ProjectNavbar from "@/features/ui/Navbar";
import { setAllFavoriteRenders } from "@/store/slices/favoritesSlice";
import store from "@/store/store";

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
  const [forceUpdateValue, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useBackendSetter();
  const dispatch = useAppDispatch();

  /**
   * Initialise local files service webworker andoad favourites on app init.
   */
  useEffect(() => {
    const favorites = getLocalStorageFavorites();
    if (Object.keys(favorites).length > 0) {
      dispatch(setAllFavoriteRenders(favorites));
    }
    localFilesService.initialiseWorker();
  }, []);

  return (
    <DownloadContextProvider value={downloadContext}>
      <LocalFilesContextProvider
        value={{ localFilesService, forceUpdate, forceUpdateValue }}
      >
        {consent === true && (
          <GoogleAnalytics trackPageViews gaMeasurementId="G-JV8WV3FQML" />
        )}
        <Toasts />
        <Modals />
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
