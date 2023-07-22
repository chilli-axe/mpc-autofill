import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import styled from "styled-components";

import { useGetBackendInfoQuery } from "@/app/api";
import { ContentMaxWidth, NavbarLogoHeight } from "@/common/constants";
import { BackendConfig } from "@/features/backend/backend";
import {
  useBackendConfigured,
  useProjectName,
} from "@/features/backend/backendSlice";
import { SupportBackendModal } from "@/features/support/supportBackend";
import { SupportDeveloperModal } from "@/features/support/supportDeveloper";
import DisableSSR from "@/features/ui/disableSSR";

const MaxWidthContainer = styled(Container)`
  max-width: ${ContentMaxWidth}px;
`;

const NoVerticalPaddingNavbar = styled(Navbar)`
  --bs-navbar-padding-y: 0px;
`;

const BoldCollapse = styled(Navbar.Collapse)`
  font-weight: bold;
`;

export default function ProjectNavbar() {
  const backendConfigured = useBackendConfigured();
  const backendInfoQuery = useGetBackendInfoQuery();

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

  const projectName = useProjectName();
  const router = useRouter();

  return (
    <DisableSSR>
      <NoVerticalPaddingNavbar
        expand="lg"
        fixed="top"
        variant="dark"
        bg="primary"
        collapseOnSelect
      >
        <MaxWidthContainer className="justify-content-center align-middle">
          <Navbar.Brand href="/" as={Link}>
            <Image
              src="/logolowres.png"
              alt="logo"
              width={NavbarLogoHeight}
              height={NavbarLogoHeight}
            />{" "}
            <span className="align-middle">
              <b>{projectName}</b>
            </span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <BoldCollapse id="basic-navbar-nav">
            <Nav className="me-auto">
              {backendConfigured && (
                <Nav.Link
                  as={Link}
                  href="/editor"
                  active={router.route === "/editor"}
                >
                  Editor
                </Nav.Link>
              )}
              {backendConfigured && (
                <>
                  <Nav.Link
                    as={Link}
                    href="/new"
                    active={router.route === "/new"}
                  >
                    What&apos;s New?
                  </Nav.Link>
                  <Nav.Link
                    as={Link}
                    href="/contributions"
                    active={router.route === "/contributions"}
                  >
                    Contributions
                  </Nav.Link>
                </>
              )}
              <Nav.Link
                as={Link}
                href="https://github.com/chilli-axe/mpc-autofill/wiki/Overview"
                target="_blank"
              >
                Wiki
              </Nav.Link>
              <Nav.Link
                href="https://github.com/chilli-axe/mpc-autofill/releases/latest"
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
            <Nav className="ms-auto d-flex">
              <Button
                className="my-xl-0 my-lg-0 my-md-2 my-sm-2 my-2"
                variant="success"
                onClick={handleShowBackendConfig}
                aria-label="configure-server-btn"
              >
                Configure Server
              </Button>
            </Nav>
          </BoldCollapse>
        </MaxWidthContainer>
      </NoVerticalPaddingNavbar>
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
