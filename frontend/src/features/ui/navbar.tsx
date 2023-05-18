import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import BSNavbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import { useSelector } from "react-redux";
import styled from "styled-components";

import { useGetBackendInfoQuery } from "@/app/api";
import { RootState } from "@/app/store";
import { ProjectName } from "@/common/constants";
import { BackendConfig } from "@/features/backend/backend";
import { selectBackendURL } from "@/features/backend/backendSlice";
import { SupportBackendModal } from "@/features/support/supportBackend";
import { SupportDeveloperModal } from "@/features/support/supportDeveloper";
import DisableSSR from "@/features/ui/disableSSR";

const MaxWidthContainer = styled(Container)`
  max-width: 1200px;
`;

const MinHeightNavbar = styled(BSNavbar)`
  min-height: 50px;
`;

const BoldCollapse = styled(BSNavbar.Collapse)`
  font-weight: bold;
`;

export default function Navbar() {
  const backendURL = useSelector(selectBackendURL);
  const backendInfoQuery = useGetBackendInfoQuery(undefined, {
    skip: backendURL == null,
  });

  const [showBackendConfig, setShowBackendConfig] = useState(false);
  const [showSupportDeveloperModal, setShowSupportDeveloperModal] =
    useState(false);
  const [showSupportBackendModal, setShowSupportBackendModal] = useState(false);

  const handleCloseBackendConfig = () => setShowBackendConfig(false);
  const handleShowBackendConfig = () => setShowBackendConfig(true);
  const handleCloseSupportDeveloperModal = () =>
    setShowSupportDeveloperModal(false);
  const handleShowSupportDeveloperModal = () =>
    setShowSupportDeveloperModal(true);
  const handleCloseSupportBackendModal = () =>
    setShowSupportBackendModal(false);
  const handleShowSupportBackendModal = () => setShowSupportBackendModal(true);

  const name =
    (backendInfoQuery.isSuccess ? backendInfoQuery.data?.name : null) ??
    ProjectName;

  return (
    <DisableSSR>
      <MinHeightNavbar expand="lg" fixed="top" variant="dark" bg="primary">
        <MaxWidthContainer className="justify-content-center fixed-top align-middle bg-primary">
          <BSNavbar.Brand href="/" as={Link}>
            <Image src="/logolowres.png" alt="logo" width="40" height="40" />{" "}
            <span className="align-middle">
              <b>{name}</b>
            </span>
          </BSNavbar.Brand>
          <BSNavbar.Toggle aria-controls="basic-navbar-nav" />
          <BoldCollapse id="basic-navbar-nav">
            {/* TODO: i don't know what the above `id` is doing */}
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
              <NavDropdown title="Donate">
                <NavDropdown.Item onClick={handleShowSupportDeveloperModal}>
                  <i className="bi bi-code" /> Support the Developer
                </NavDropdown.Item>
                {backendInfoQuery.data?.name != null &&
                  (backendInfoQuery.data?.patreon?.url ?? "").trim().length >
                    0 && (
                    <NavDropdown.Item onClick={handleShowSupportBackendModal}>
                      <i className="bi bi-server" /> Support{" "}
                      {backendInfoQuery.data.name}
                    </NavDropdown.Item>
                  )}
              </NavDropdown>
            </Nav>
            <Nav className="ms-auto">
              <Button variant="secondary" onClick={handleShowBackendConfig}>
                Configure Server
              </Button>
            </Nav>
          </BoldCollapse>
        </MaxWidthContainer>
      </MinHeightNavbar>
      <BackendConfig
        show={showBackendConfig}
        handleClose={handleCloseBackendConfig}
      />
      <SupportDeveloperModal
        show={showSupportDeveloperModal}
        handleClose={handleCloseSupportDeveloperModal}
      />
      <SupportBackendModal
        show={showSupportBackendModal}
        handleClose={handleCloseSupportBackendModal}
      />
    </DisableSSR>
  );
}
