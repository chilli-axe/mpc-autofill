import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import { useGetBackendInfoQuery } from "@/app/api";
import { Spinner } from "@/features/ui/spinner";

interface SupportBackendModalProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function SupportBackendModal(props: SupportBackendModalProps) {
  const backendInfoQuery = useGetBackendInfoQuery();

  return (
    <Modal show={props.show} onHide={props.handleClose}>
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
        <Button variant="secondary" onClick={props.handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
