import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

import {
  useGetNewCardsFirstPageQuery,
  useGetNewCardsPageQuery,
} from "@/app/api";
import { CardDocument, useAppSelector } from "@/common/types";
import { NewCardsFirstPage } from "@/common/types";
import { selectBackendURL } from "@/features/backend/backendSlice";
import { MemoizedCardRenameMe } from "@/features/card/card";
import { NoBackendDefault } from "@/features/ui/noBackendDefault";
import { Spinner } from "@/features/ui/spinner";

function NewCard({ cardDocument }: { cardDocument: CardDocument }) {
  /**
   * This component is a thin layer on top of `CardRenameMe` for use in the What's New page.
   */

  return (
    <Col>
      <MemoizedCardRenameMe
        key={`new-cards-${cardDocument.identifier}`}
        maybeCardDocument={cardDocument}
        cardHeaderTitle={cardDocument.date}
        noResultsFound={false}
      />
    </Col>
  );
}

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

  // style="display: inline" className="orpheus"
  // style="display: inline" className="text-primary"
  // TODO: detailed view

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
      <h3>
        <em>{firstPage.source.name}</em>
      </h3>
      <div>
        {firstPage.hits} new card{firstPage.hits != 1 && "s"}
      </div>
      <Row xxl={6} lg={4} md={3} sm={2} xs={2} className="g-0">
        {firstPage.cards.map((card) => (
          <NewCard
            cardDocument={card}
            key={`whats-new-card-${card.identifier}`}
          />
        ))}
        {(getNewCardsPageQuery.data ?? []).map((card) => (
          <NewCard
            cardDocument={card}
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
  return getNewCardsQuery.isFetching || getNewCardsQuery.data == null ? (
    <Spinner />
  ) : (
    <>
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
  );
}
