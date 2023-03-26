import Nav from "react-bootstrap/Nav";
import BSNavbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import Container from "react-bootstrap/Container";
import Image from "next/image";

export default function Navbar() {
  return (
    <BSNavbar
      expand="lg"
      fixed="top"
      variant="dark"
      bg="primary"
      style={{ height: 50 + "px" }}
    >
      <Container
        className="justify-content-center fixed-top align-middle"
        bg="primary"
        style={{ maxWidth: 1200 + "px" }}
      >
        <BSNavbar.Brand href="/">
          <Image src="/logolowres.png" alt="logo" width="40" height="40" />{" "}
          <span className="align-middle">
            <b>MPC Autofill</b>
          </span>
        </BSNavbar.Brand>
        <BSNavbar.Toggle aria-controls="basic-navbar-nav" />
        <BSNavbar.Collapse id="basic-navbar-nav" style={{ fontWeight: "bold" }}>
          <Nav className="me-auto">
            <Nav.Link href="/guide">Guide</Nav.Link>
            <Nav.Link href="/new">What's New?</Nav.Link>
            <Nav.Link href="/contributions">Contributions</Nav.Link>
            <Nav.Link
              href="https://github.com/chilli-axe/mpc-autofill/releases"
              target="_blank"
            >
              Download
            </Nav.Link>
          </Nav>
          {/* <Nav className="ms-auto"> */}
          {/* </Nav> */}
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
}
