import React from "react";
import Alert from "react-bootstrap/Alert";
import Stack from "react-bootstrap/Stack";

import { useAppSelector } from "@/common/types";
import { Spinner } from "@/components/spinner";

export function SearchStatus() {
  const fetchingCardData = useAppSelector(
    (state) => state.cardDocuments.status === "loading"
  );
  return fetchingCardData ? (
    <Alert variant="primary">
      <Stack direction="horizontal" gap={2} className="d-flex ps-2 pe-2">
        <div className="me-auto">
          <h5>Loading Card Data...</h5>
          Some search results may appear incomplete until this is finished.
        </div>
        <Spinner size={2.5} />
      </Stack>
    </Alert>
  ) : (
    <></>
  );
}
