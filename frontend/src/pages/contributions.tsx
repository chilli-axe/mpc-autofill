import Head from "next/head";
import Link from "next/link";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Table from "react-bootstrap/Table";
import { useSelector } from "react-redux";
import styled from "styled-components";

import { useGetBackendInfoQuery, useGetContributionsQuery } from "@/app/api";
import {
  Card,
  Cardback,
  MakePlayingCards,
  MakePlayingCardsURL,
  ProjectName,
  Token,
} from "@/common/constants";
import { SourceContribution } from "@/common/types";
import { selectBackendURL } from "@/features/backend/backendSlice";
import Footer from "@/features/ui/footer";
import Layout from "@/features/ui/layout";
import { Spinner } from "@/features/ui/spinner";

const AutoLayoutTable = styled(Table)`
  table-layout: auto;
`;

function ContributionsSummary() {
  const backendURL = useSelector(selectBackendURL);
  const contributionsQuery = useGetContributionsQuery(undefined, {
    skip: backendURL == null,
  });
  const backendInfoQuery = useGetBackendInfoQuery(undefined, {
    skip: backendURL == null,
  });

  const totalImages =
    contributionsQuery.data?.card_count_by_type != null
      ? Object.values(contributionsQuery.data.card_count_by_type).reduce(
          (a, b) => a + b,
          0
        )
      : 0;
  const formattedDatabaseSize = (
    Math.round(
      ((contributionsQuery.data?.total_database_size ?? 0) / 1_000_000_000) *
        100
    ) / 100
  ).toLocaleString();
  const formattedImagesByCardType = Object.fromEntries(
    [Card, Cardback, Token].map((cardType) => [
      cardType,
      (
        (contributionsQuery.data?.card_count_by_type ?? {})[cardType] ?? 0
      ).toLocaleString(),
    ])
  );

  return backendInfoQuery.isSuccess ? (
    <>
      <h2>{backendInfoQuery.data?.name ?? ""} Contributions</h2>
      <p>
        The {backendInfoQuery.data?.name ?? ""} database tracks{" "}
        <b>{totalImages.toLocaleString()}</b> images, with a total size of{" "}
        <b>{formattedDatabaseSize} GB</b> &mdash; comprised of{" "}
        <b>{formattedImagesByCardType[Card]}</b> cards,{" "}
        <b>{formattedImagesByCardType[Cardback]}</b> cardbacks, and{" "}
        <b>{formattedImagesByCardType[Token]}</b> tokens &mdash; from{" "}
        <b>{(contributionsQuery.data?.sources ?? []).length}</b> sources.
      </p>
      <p>
        {ProjectName} databases are typically synced with all sources every day
        (beginning at midnight UTC) to ensure all changes are recorded in a
        timely manner.
      </p>
    </>
  ) : (
    <br />
  );
}

function ContributionGuidelines() {
  const backendURL = useSelector(selectBackendURL);
  const backendInfoQuery = useGetBackendInfoQuery(undefined, {
    skip: backendURL == null,
  });

  const name = backendInfoQuery.data?.name ?? ProjectName;

  return (
    <Alert variant="secondary">
      <h3>Contribution Guidelines</h3>
      <ul>
        <li>
          Image filetype must be either <code>png</code> (recommended) or{" "}
          <code>jpeg</code>
        </li>
        <li>
          When you have multiple versions of a card in the same folder, use
          parentheses to differentiate them &mdash; e.g.{" "}
          <code>Image A.png</code> and <code>Image A (Extended).png</code>
          <ul>
            <li>
              The text in parentheses (e.g. <code>Extended</code> in the above
              example) will be ignored by the search engine.
            </li>
          </ul>
        </li>
        <li>
          If a card has multiple names, use an ampersand to separate them
          &mdash; e.g. <code>Fire & Ice.png</code>
        </li>
        <li>
          Store your token images in a folder called <code>Tokens</code>{" "}
          (anywhere in your repository)
        </li>
        <li>
          Store your cardback images in a folder called <code>Cardbacks</code>{" "}
          (anywhere in your repository)
        </li>
        <li>
          Prepend the names of any folders you don&apos;t want to be indexed by{" "}
          {name} with <code>!</code>
          &mdash; e.g. <code>!Misc and Art</code>
        </li>
        <li>
          Limit your files to less than <b>30 MB</b> per image &mdash; this is
          the maximum that Google Scripts can return in one request and the
          maximum that{" "}
          <a href={MakePlayingCardsURL} target="_blank">
            {MakePlayingCards}
          </a>{" "}
          accepts, meaning the desktop client won&apos;t work with images that
          exceed this limit.
        </li>
      </ul>
    </Alert>
  );
}

interface SourceContributionRowProps {
  contribution: SourceContribution;
}

function SourceContributionRow({ contribution }: SourceContributionRowProps) {
  /**
   * Table row for `contribution` in the `ContributionsPerSource` summary table.
   */

  return (
    <tr key={contribution.name}>
      <td>
        {contribution.external_link != null ? (
          <Link href={contribution.external_link} target="_blank">
            {contribution.name}
          </Link>
        ) : (
          contribution.name
        )}
      </td>
      <td>{contribution.source_type}</td>
      <td>
        <b>{contribution.qty_cards}</b> card
        {contribution.qty_cards != "1" && "s"},{" "}
        <b>{contribution.qty_cardbacks}</b> cardback
        {contribution.qty_cardbacks != "1" && "s"}, and{" "}
        <b>{contribution.qty_tokens}</b> token
        {contribution.qty_tokens != "1" && "s"}, at{" "}
        <b>{contribution.avgdpi} DPI</b> on average and a total size of{" "}
        <b>{contribution.size}</b>.
        {contribution.description.length > 0 && (
          <>
            <br />
            <i>&quot;{contribution.description}&quot;</i>
          </>
        )}
      </td>
    </tr>
  );
}

function ContributionsPerSource() {
  const backendURL = useSelector(selectBackendURL);
  const contributionsQuery = useGetContributionsQuery(undefined, {
    skip: backendURL == null,
  });

  return contributionsQuery.isSuccess ? (
    contributionsQuery.isLoading || contributionsQuery.data?.sources == null ? (
      <Spinner />
    ) : (
      <AutoLayoutTable>
        <thead>
          <tr>
            <th className="prevent-select">Name</th>
            <th className="prevent-select">Type</th>
            <th className="prevent-select">Contribution</th>
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {contributionsQuery.data.sources.map((contribution) => (
            <SourceContributionRow
              key={`${contribution.name}-row`}
              contribution={contribution}
            />
          ))}
        </tbody>
      </AutoLayoutTable>
    )
  ) : (
    <></>
  );
}

export default function Contributions() {
  return (
    <>
      <Head>
        <title>{ProjectName} Contributions</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <ContributionsSummary />
        <ContributionGuidelines />
        <ContributionsPerSource />
        <Footer />
      </Layout>
    </>
  );
}
