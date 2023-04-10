import Navbar from "./navbar";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider } from "react-redux";
import store from "@/app/store";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { Toasts } from "@/features/toasts/toasts";
import { getGoogleAnalyticsConsent } from "@/common/cookies";

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
