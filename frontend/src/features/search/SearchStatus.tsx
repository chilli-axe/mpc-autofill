import React from "react";
import Stack from "react-bootstrap/Stack";

import { useAppSelector } from "@/common/types";
import { Jumbotron } from "@/components/Jumbotron";
import { Spinner } from "@/components/Spinner";

export function SearchStatus() {
  const fetchingCardData = useAppSelector(
    (state) => state.cardDocuments.status === "loading"
  );
  return fetchingCardData ? (
    <Jumbotron variant="primary">
      <Stack direction="horizontal" gap={2} className="d-flex px-2">
        <div className="me-auto">
          <h5>Loading Card Data...</h5>
          Some search results may appear incomplete until this is finished.
        </div>
        <Spinner size={2.5} />
      </Stack>
    </Jumbotron>
  ) : null;
}
