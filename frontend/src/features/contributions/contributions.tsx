import { useGetBackendInfoQuery, useGetContributionsQuery } from "@/app/api";
import { ProjectName } from "@/common/constants";

export function Contributions() {
  const contributionsQuery = useGetContributionsQuery();
  const backendInfoQuery = useGetBackendInfoQuery();
  const totalImages = Object.values(
    contributionsQuery.data?.card_count_by_type
  ).reduce((a, b) => a + b, 0);

  return (
    <>
      <h2>Contributions</h2>
      <p>
        The {backendInfoQuery.data?.name ?? ProjectName} database contains{" "}
        <b>{totalImages.toLocaleString()}</b> images, with a total size of
        {/*{contributionsQuery.data?.}*/}
      </p>
    </>
  );
}
