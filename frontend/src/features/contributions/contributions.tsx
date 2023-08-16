import Link from "next/link";
import React from "react";

import { useGetBackendInfoQuery, useGetContributionsQuery } from "@/app/api";
import { Card, Cardback, ProjectName, Token } from "@/common/constants";
import { SourceContribution } from "@/common/types";
import { useProjectName } from "@/features/backend/backendSlice";
import { Spinner } from "@/features/ui/spinner";
import { AutoLayoutTable, TableWrapper } from "@/features/ui/styledComponents";

export function ContributionsSummary() {
  const contributionsQuery = useGetContributionsQuery();
  const backendInfoQuery = useGetBackendInfoQuery();
  const projectName = useProjectName();

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
      <h2>{projectName} Contributions</h2>
      <p>
        The {projectName} database tracks <b>{totalImages.toLocaleString()}</b>{" "}
        images, with a total size of <b>{formattedDatabaseSize} GB</b> &mdash;
        comprised of <b>{formattedImagesByCardType[Card]}</b> cards,{" "}
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
        {contribution.external_link != null &&
        contribution.external_link.length > 0 ? (
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

export function ContributionsPerSource() {
  const contributionsQuery = useGetContributionsQuery();

  return contributionsQuery.isSuccess ? (
    contributionsQuery.isFetching ||
    contributionsQuery.data?.sources == null ? (
      <Spinner />
    ) : (
      <TableWrapper>
        <AutoLayoutTable>
          <thead>
            <tr>
              <th className="prevent-select">Name</th>
              <th className="prevent-select">Type</th>
              <th className="prevent-select">Contribution</th>
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
      </TableWrapper>
    )
  ) : (
    <></>
  );
}
