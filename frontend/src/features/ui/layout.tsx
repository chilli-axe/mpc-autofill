import { useRouter } from "next/router";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { useEffect } from "react";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider, useDispatch, useSelector } from "react-redux";

import store from "@/app/store";
import { getGoogleAnalyticsConsent } from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import { selectBackendURL, setURL } from "@/features/backend/backendSlice";
import { Toasts } from "@/features/toasts/toasts";
import Navbar from "@/features/ui/navbar";

function BackendSetter() {
  const router = useRouter();
  const { server } = router.query;
  const formattedURL: string | null =
    server != null && typeof server == "string"
      ? standardiseURL(server.trim())
      : null;

  const dispatch = useDispatch();
  const backendURL = useSelector(selectBackendURL);
  useEffect(() => {
    if (backendURL == null && (formattedURL ?? "").length > 0) {
      dispatch(setURL(formattedURL));
    }
  }, [router.isReady, backendURL, formattedURL, dispatch]);

  return <></>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const consent = getGoogleAnalyticsConsent();
  return (
    <>
      {consent === true && <GoogleAnalytics trackPageViews />}
      <SSRProvider>
        <Provider store={store}>
          <Toasts />
          <BackendSetter />
          <Navbar />
          <Container className="addmargin" style={{ maxWidth: 1200 + "px" }}>
            {children}
          </Container>
        </Provider>
      </SSRProvider>
    </>
  );
}
