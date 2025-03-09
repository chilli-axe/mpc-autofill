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

import { ContentMaxWidth, NavbarLogoHeight } from "@/common/constants";
import { useAppDispatch } from "@/common/types";
import DisableSSR from "@/components/DisableSSR";
import { BackendConfig } from "@/features/backend/BackendConfig";
import { DownloadManager } from "@/features/download/DownloadManager";
import { useGetBackendInfoQuery } from "@/store/api";
import {
  useBackendConfigured,
  useProjectName,
} from "@/store/slices/backendSlice";
import { showModal } from "@/store/slices/modalsSlice";

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
  const dispatch = useAppDispatch();
  const backendConfigured = useBackendConfigured();
  const backendInfoQuery = useGetBackendInfoQuery();

  const [showBackendConfig, setShowBackendConfig] = useState<boolean>(false);

  const handleCloseBackendConfig = () => setShowBackendConfig(false);
  const handleShowBackendConfig = () => setShowBackendConfig(true);

  const handleShowSupportDeveloperModal = () => {
    dispatch(showModal("supportDeveloper"));
  };
  const handleShowSupportBackendModal = () => {
    dispatch(showModal("supportBackend"));
  };

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
                    href="/explore"
                    active={router.route === "/explore"}
                  >
                    Explore
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
              <Nav.Link className="p-0">
                <DownloadManager />
              </Nav.Link>
              {process.env.NEXT_PUBLIC_BACKEND_URL == null && (
                <Nav.Link>
                  <Button
                    className="my-xl-0 my-lg-0 my-md-2 my-sm-2 my-2"
                    variant="success"
                    onClick={handleShowBackendConfig}
                    aria-label="configure-server-btn"
                  >
                    Configure Server
                  </Button>
                </Nav.Link>
              )}
            </Nav>
          </BoldCollapse>
        </MaxWidthContainer>
      </NoVerticalPaddingNavbar>
      <BackendConfig
        show={showBackendConfig}
        handleClose={handleCloseBackendConfig}
      />
    </DisableSSR>
  );
}
