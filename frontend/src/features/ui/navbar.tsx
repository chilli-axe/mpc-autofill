import Nav from "react-bootstrap/Nav";
import BSNavbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import Container from "react-bootstrap/Container";
import Image from "next/image";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/store";
import { ProjectName } from "@/common/constants";
import { BackendConfig } from "@/features/backend/backend";
import { useState } from "react";
import { clearURL } from "@/features/backend/backendSlice";
import DisableSSR from "@/features/ui/disableSSR";
import { apiSlice, useGetBackendInfoQuery } from "@/app/api";
import { clearCookieBackendURL } from "@/common/cookies";

export default function Navbar() {
  const dispatch = useDispatch();
  const backendInfoQuery = useGetBackendInfoQuery();

  const [showBackendConfig, setShowBackendConfig] = useState(false);

  const handleCloseBackendConfig = () => {
    setShowBackendConfig(false);
  };
  const handleShowBackendConfig = () => setShowBackendConfig(true);

  const backendURL = useSelector((state: RootState) => state.backend.url);

  const clearBackendURL = () => {
    dispatch(clearURL());
    clearCookieBackendURL();
    dispatch(apiSlice.util.resetApiState());
  };

  return (
    <DisableSSR>
      <BSNavbar
        expand="lg"
        fixed="top"
        variant="dark"
        bg="primary"
        style={{ height: 50 + "px" }}
      >
        <Container
          className="justify-content-center fixed-top align-middle"
          style={{ maxWidth: 1200 + "px" }}
        >
          <BSNavbar.Brand href="/" as={Link}>
            <Image src="/logolowres.png" alt="logo" width="40" height="40" />{" "}
            <span className="align-middle">
              <b>{backendInfoQuery.data?.name ?? ProjectName}</b>
            </span>
          </BSNavbar.Brand>
          <BSNavbar.Toggle aria-controls="basic-navbar-nav" />
          <BSNavbar.Collapse
            id="basic-navbar-nav"
            style={{ fontWeight: "bold" }}
          >
            <Nav className="me-auto">
              <Nav.Link as={Link} href="/editor">
                Editor (Temp)
              </Nav.Link>
              <Nav.Link as={Link} href="/guide">
                Guide
              </Nav.Link>
              {backendURL != null && (
                <>
                  <Nav.Link as={Link} href="/new">
                    What&apos;s New?
                  </Nav.Link>
                  <Nav.Link as={Link} href="/contributions">
                    Contributions
                  </Nav.Link>
                </>
              )}
              <Nav.Link
                href="https://github.com/chilli-axe/mpc-autofill/releases"
                target="_blank"
              >
                Download
              </Nav.Link>
            </Nav>
            <Nav className="ms-auto">
              {backendURL == null ? (
                <Nav.Link onClick={handleShowBackendConfig}>
                  Configure Server
                </Nav.Link>
              ) : (
                <NavDropdown title={backendInfoQuery.data?.name ?? backendURL}>
                  <NavDropdown.Item onClick={handleShowBackendConfig}>
                    Configure Server
                  </NavDropdown.Item>
                  <NavDropdown.Item onClick={clearBackendURL}>
                    Exit Server
                  </NavDropdown.Item>
                </NavDropdown>
              )}
            </Nav>
          </BSNavbar.Collapse>
        </Container>
      </BSNavbar>
      <BackendConfig
        show={showBackendConfig}
        handleClose={handleCloseBackendConfig}
      />
    </DisableSSR>
  );
}
