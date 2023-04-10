import { useGetBackendInfoQuery, useGetContributionsQuery } from "@/app/api";
import { Card, Cardback, ProjectName, Token } from "@/common/constants";
import Alert from "react-bootstrap/Alert";

function ContributionGuidelines() {
  const backendInfoQuery = useGetBackendInfoQuery();

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
          maximum that MakePlayingCards.com accepts, meaning the desktop client
          won&apos;t work with images that exceed this limit.
        </li>
      </ul>
    </Alert>
  );
}

export function Contributions() {
  const contributionsQuery = useGetContributionsQuery();
  const backendInfoQuery = useGetBackendInfoQuery();

  const name = backendInfoQuery.data?.name ?? ProjectName;
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

  return (
    <>
      <h2>Contributions</h2>
      <p>
        The {name} database tracks <b>{totalImages.toLocaleString()}</b> images,
        with a total size of <b>{formattedDatabaseSize} GB</b> &mdash; comprised
        of <b>{formattedImagesByCardType[Card]}</b> cards,{" "}
        <b>{formattedImagesByCardType[Cardback]}</b> cardbacks, and{" "}
        <b>{formattedImagesByCardType[Token]}</b> tokens &mdash; from{" "}
        <b>{(contributionsQuery.data?.sources ?? []).length}</b> sources.
      </p>
      <p>
        {ProjectName} databases are typically synced with all sources every day
        (beginning at midnight UTC) to ensure all changes are recorded in a
        timely manner.
      </p>
      <ContributionGuidelines />
    </>
  );
}
