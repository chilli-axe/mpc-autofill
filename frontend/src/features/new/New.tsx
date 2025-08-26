import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import styled from "styled-components";

import { NewCardsFirstPage } from "@/common/types";
import { Spinner } from "@/components/Spinner";
import { DatedCard } from "@/features/card/Card";
import {
  useGetNewCardsFirstPageQuery,
  useGetNewCardsPageQuery,
} from "@/store/api";
import { useProjectName } from "@/store/slices/backendSlice";

const InlineHeader = styled.h3`
  display: inline;
`;

const InlineParagraph = styled.p`
  display: inline;
`;

function NewCardsForSource({
  sourceKey,
  firstPage,
}: {
  sourceKey: string;
  firstPage: NewCardsFirstPage;
}) {
  // django pagination begins at 1
  const [pageCounter, setPageCounter] = useState<number>(1);
  const getNewCardsPageQuery = useGetNewCardsPageQuery([
    sourceKey,
    pageCounter,
  ]);

  const loadMoreButton = (
    <div className="d-grid gap-0 mx-auto" style={{ maxWidth: 20 + "%" }}>
      <Button
        onClick={() => setPageCounter(pageCounter + 1)}
        disabled={getNewCardsPageQuery.isFetching}
      >
        {getNewCardsPageQuery.isFetching ? <Spinner size={1.5} /> : "Load More"}
      </Button>
    </div>
  );

  return (
    <>
      <InlineHeader className="orpheus">
        <em>{firstPage.source.name}</em>
      </InlineHeader>
      &nbsp;&nbsp;&nbsp;
      <InlineParagraph className="text-primary">
        {firstPage.hits} new card{firstPage.hits != 1 && "s"}
      </InlineParagraph>
      <Row xxl={6} lg={4} md={3} sm={2} xs={2} className="g-0">
        {firstPage.cards.map((card) => (
          <DatedCard
            cardDocument={card}
            headerDate="created"
            key={`whats-new-card-${card.identifier}`}
          />
        ))}
        {(getNewCardsPageQuery.data ?? []).map((card) => (
          <DatedCard
            cardDocument={card}
            headerDate="created"
            key={`whats-new-card-${card.identifier}`}
          />
        ))}
      </Row>
      <br />
      {pageCounter < firstPage.pages && loadMoreButton}
    </>
  );
}

export function NewCards() {
  const getNewCardsQuery = useGetNewCardsFirstPageQuery();
  const projectName = useProjectName();
  return getNewCardsQuery.isFetching || getNewCardsQuery.data == null ? (
    <Spinner />
  ) : (
    <div>
      {Object.keys(getNewCardsQuery.data).length > 0 ? (
        <>
          <p>
            Check out the new cards added to {projectName} in the last two
            weeks.
          </p>
          {Object.entries(getNewCardsQuery.data).map(
            ([sourceKey, firstPage], index) => (
              <>
                {index != 0 && <hr />}
                <NewCardsForSource
                  key={sourceKey}
                  sourceKey={sourceKey}
                  firstPage={firstPage}
                />
              </>
            )
          )}
        </>
      ) : (
        <p>
          Looks like nothing was added to {projectName} in the last two weeks.
          :(
        </p>
      )}
    </div>
  );
}
