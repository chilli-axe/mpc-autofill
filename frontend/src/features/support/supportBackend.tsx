import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useSelector } from "react-redux";

import { useGetBackendInfoQuery } from "@/app/api";
import { selectBackendURL } from "@/features/backend/backendSlice";
import { Spinner } from "@/features/ui/spinner";

interface SupportBackendModalProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function SupportBackendModal({
  show,
  handleClose,
}: SupportBackendModalProps) {
  const backendURL = useSelector(selectBackendURL);
  const backendInfoQuery = useGetBackendInfoQuery(undefined, {
    skip: backendURL == null,
  });

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>
          Support {backendInfoQuery.data?.name ?? "Your Server Manager"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {backendInfoQuery?.data?.patreon == null ? (
          <Spinner />
        ) : (
          <>
            <h4>Patron Tiers</h4>
            {Object.values(backendInfoQuery.data.patreon.tiers ?? {}).map(
              (tier) => (
                <h6 key={`patreon-tier-${tier.title}`}>
                  <b>
                    {tier.title} (${tier.usd} USD)
                  </b>
                </h6>
              )
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
