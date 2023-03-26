import Navbar from "./navbar";
import Container from "react-bootstrap/Container";
import SSRProvider from "react-bootstrap/SSRProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SSRProvider>
      <Navbar />
      <Container className="addmargin" style={{ maxWidth: 1200 + "px" }}>
        {/* TODO: error message toasts here */}
        {children}
      </Container>
    </SSRProvider>
  );
}
