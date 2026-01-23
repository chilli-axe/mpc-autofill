import Link from "next/link";
import React from "react";

import { Card, Cardback, ProjectName, Token } from "@/common/constants";
import { SourceContribution } from "@/common/types";
import { AutofillTable } from "@/components/AutofillTable";
import { Spinner } from "@/components/Spinner";
import { useGetContributionsQuery } from "@/store/api";
import { useProjectName } from "@/store/slices/backendSlice";

export function ContributionsSummary() {
  //# region queries and hooks

  const contributionsQuery = useGetContributionsQuery();
  const projectName = useProjectName();

  //# endregion

  //# region computed constants

  const totalImages =
    contributionsQuery.data?.cardCountByType != null
      ? Object.values(contributionsQuery.data.cardCountByType).reduce(
          (a, b) => a + b,
          0
        )
      : 0;
  const formattedDatabaseSize = (
    Math.round(
      ((contributionsQuery.data?.totalDatabaseSize ?? 0) / 1_000_000_000) * 100
    ) / 100
  ).toLocaleString();
  const formattedImagesByCardType = Object.fromEntries(
    [Card, Cardback, Token].map((cardType) => [
      cardType,
      (
        (contributionsQuery.data?.cardCountByType ?? {})[cardType] ?? 0
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
            <b>{formattedDatabaseSize} GB</b> &mdash; comprising{" "}
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
      <b>{contribution.qtyCards}</b> card
      {contribution.qtyCards != "1" && "s"}, <b>{contribution.qtyCardbacks}</b>{" "}
      cardback
      {contribution.qtyCardbacks != "1" && "s"}, and{" "}
      <b>{contribution.qtyTokens}</b> token
      {contribution.qtyTokens != "1" && "s"}, at{" "}
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
        contribution.externalLink != null ? (
          <Link href={contribution.externalLink} target="_blank">
            {contribution.name}
          </Link>
        ) : (
          contribution.name
        ),
        contribution.sourceType,
        <ContributionDescription
          key={`${contribution.name}-description`}
          contribution={contribution}
        />,
      ])}
      hover={true}
      alignment={"left"}
      uniformWidth={false}
      variant="default"
    />
  );
}
