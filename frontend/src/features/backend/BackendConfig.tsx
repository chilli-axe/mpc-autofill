/**
 * This component allows users to configure which backend server the frontend should retrieve data from.
 */

import React from "react";
import Offcanvas from "react-bootstrap/Offcanvas";

import { LocalFolderBackendConfig } from "@/features/backend/LocalFolderBackendConfig";
import { RemoteBackendConfig } from "@/features/backend/RemoteBackendConfig";
import { getEnvURL } from "@/features/backend/useBackendSetter";

interface BackendConfigProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function BackendConfig({ show, handleClose }: BackendConfigProps) {
  const envURL = getEnvURL();
  return (
    <Offcanvas show={show} onHide={handleClose} data-testid="backend-offcanvas">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Configure Sources</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {envURL === undefined && (
          <>
            <RemoteBackendConfig />
            <hr />
          </>
        )}
        <LocalFolderBackendConfig />
      </Offcanvas.Body>
    </Offcanvas>
  );
}
