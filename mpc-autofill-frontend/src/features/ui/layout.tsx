import Navbar from "./navbar";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider } from "react-redux";
import store from "@/app/store";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SSRProvider>
      <Navbar />
      <Container className="addmargin" style={{ maxWidth: 1200 + "px" }}>
        {/* TODO: error message toasts here */}
        <Provider store={store}>{children}</Provider>
      </Container>
    </SSRProvider>
  );
}
