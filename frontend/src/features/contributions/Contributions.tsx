import Link from "next/link";
import React from "react";

import { Card, Cardback, ProjectName, Token } from "@/common/constants";
import { SourceContribution } from "@/common/types";
import { AutofillTable } from "@/components/AutofillTable";
import { Spinner } from "@/components/Spinner";
import { useProjectName } from "@/features/backend/backendSlice";
import { useGetContributionsQuery } from "@/store/api";

export function ContributionsSummary() {
  //# region queries and hooks

  const contributionsQuery = useGetContributionsQuery();
  const projectName = useProjectName();

  //# endregion

  //# region computed constants

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

  //# endregion

  return (
    <>
      <h1>{projectName} Contributions</h1>
      {contributionsQuery.data?.sources == null ? (
        <Spinner />
      ) : (
        <>
          <p>
            The {projectName} database tracks{" "}
            <b>{totalImages.toLocaleString()}</b> images, with a total size of{" "}
            <b>{formattedDatabaseSize} GB</b> &mdash; comprised of{" "}
            <b>{formattedImagesByCardType[Card]}</b> cards,{" "}
            <b>{formattedImagesByCardType[Cardback]}</b> cardbacks, and{" "}
            <b>{formattedImagesByCardType[Token]}</b> tokens &mdash; from{" "}
            <b>{(contributionsQuery.data.sources ?? []).length}</b> sources.
          </p>
          <p>
            {ProjectName} databases are typically synced with all sources every
            day (beginning at midnight UTC) to ensure all changes are recorded
            in a timely manner.
          </p>
        </>
      )}
    </>
  );
}

function ContributionDescription({
  contribution,
}: {
  contribution: SourceContribution;
}) {
  return (
    <>
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
    </>
  );
}

export function ContributionsPerSource() {
  //# region queries and hooks

  const contributionsQuery = useGetContributionsQuery();

  //# endregion

  return contributionsQuery.isFetching ||
    contributionsQuery.data?.sources == null ? (
    <Spinner />
  ) : (
    <AutofillTable
      headers={["Name", "Type", "Contribution"]}
      data={contributionsQuery.data.sources.map((contribution) => [
        contribution.external_link != null ? (
          <Link href={contribution.external_link} target="_blank">
            {contribution.name}
          </Link>
        ) : (
          contribution.name
        ),
        contribution.source_type,
        <ContributionDescription
          key={`${contribution.name}-description`}
          contribution={contribution}
        />,
      ])}
      hover={true}
      centred={false}
      uniformWidth={false}
    />
  );
}
