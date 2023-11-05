import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import { useGetBackendInfoQuery } from "@/app/api";
import { Spinner } from "@/components/spinner";
import { AutofillTable } from "@/components/table";

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

  //# endregion

  return (
    <Modal scrollable show={show} onHide={handleClose} size="lg">
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
            {backendInfoQuery.data.patreon.campaign?.about != null && (
              <p
                dangerouslySetInnerHTML={{
                  __html: backendInfoQuery.data.patreon.campaign.about,
                }}
              />
            )}
            <Alert variant="info">
              <h4>Patron Tiers</h4>
              {Object.values(backendInfoQuery.data.patreon.tiers ?? {}).map(
                (tier) => (
                  <h6 key={`patreon-tier-${tier.title}`}>
                    <h6>
                      {tier.title} (${tier.usd} USD)
                    </h6>
                    <p
                      dangerouslySetInnerHTML={{ __html: tier.description }}
                    ></p>
                  </h6>
                )
              )}
              <hr />
              {backendInfoQuery.data.patreon.url != null && (
                <a
                  style={{ textAlign: "center" }}
                  href={backendInfoQuery.data.patreon.url}
                  target="_blank"
                >
                  Become a Patron today!
                </a>
              )}
            </Alert>
            {backendInfoQuery.data.patreon.members != null && (
              <>
                <h4>Patrons</h4>
                <AutofillTable
                  headers={["Name", "Tier", "Patron Since"]}
                  data={backendInfoQuery.data.patreon.members.map((patron) => [
                    patron.name,
                    patron.tier,
                    patron.date,
                  ])}
                  centred={true}
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
