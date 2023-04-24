import { GoogleAnalytics } from "nextjs-google-analytics";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider } from "react-redux";

import store from "@/app/store";
import { getGoogleAnalyticsConsent } from "@/common/cookies";
import { Toasts } from "@/features/toasts/toasts";
import Navbar from "@/features/ui/navbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  const consent = getGoogleAnalyticsConsent();
  return (
    <>
      {consent === true && <GoogleAnalytics trackPageViews />}
      <SSRProvider>
        <Provider store={store}>
          <Toasts />
          <Navbar />
          <Container className="addmargin" style={{ maxWidth: 1200 + "px" }}>
            {children}
          </Container>
        </Provider>
      </SSRProvider>
    </>
  );
}
