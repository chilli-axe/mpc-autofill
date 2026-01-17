import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import { AutofillTable } from "@/components/AutofillTable";
import { Spinner } from "@/components/Spinner";
import { useGetBackendInfoQuery, useGetPatreonQuery } from "@/store/api";

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
  //# region queries and hooks

  const backendInfoQuery = useGetBackendInfoQuery();
  const patreonQuery = useGetPatreonQuery();

  //# endregion

  return (
    <Modal scrollable show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          Support {backendInfoQuery.data?.name ?? "Your Server Manager"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {patreonQuery?.data === undefined ? (
          <Spinner />
        ) : (
          <>
            {patreonQuery.data.campaign?.about != null && (
              <p
                dangerouslySetInnerHTML={{
                  __html: patreonQuery.data.campaign.about,
                }}
              />
            )}
            <Alert variant="info">
              <h4>Patron Tiers</h4>
              {Object.values(patreonQuery.data.tiers ?? {}).map((tier) => (
                <h6 key={`patreon-tier-${tier.title}`}>
                  <h6>
                    {tier.title} (${tier.usd} USD)
                  </h6>
                  <p dangerouslySetInnerHTML={{ __html: tier.description }}></p>
                </h6>
              ))}
              <hr />
              {patreonQuery.data.url != null && (
                <a
                  style={{ textAlign: "center" }}
                  href={patreonQuery.data.url}
                  target="_blank"
                >
                  Become a Patron today!
                </a>
              )}
            </Alert>
            {patreonQuery.data.members != null && (
              <>
                <h4>Patrons</h4>
                <AutofillTable
                  headers={["Name", "Tier", "Patron Since"]}
                  data={patreonQuery.data.members.map((patron) => [
                    patron.name,
                    patron.tier,
                    patron.date,
                  ])}
                  alignment={"left"}
                  hover={true}
                  uniformWidth={false}
                />
              </>
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
