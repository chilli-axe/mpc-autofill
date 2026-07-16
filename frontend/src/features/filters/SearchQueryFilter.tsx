import Form from "react-bootstrap/Form";

import { Card } from "@/common/constants";
import { useGetSampleCardsQuery } from "@/store/api";

interface SearchQueryFilterProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export const SearchQueryFilter = ({
  searchQuery,
  setSearchQuery,
}: SearchQueryFilterProps) => {
  const getSampleCardsQuery = useGetSampleCardsQuery();
  const placeholderCardName =
    getSampleCardsQuery.data != null &&
    (getSampleCardsQuery.data ?? {})[Card][0] != null
      ? getSampleCardsQuery.data[Card][0].name
      : "";

  return (
    <>
      <Form.Control
        onChange={(event) => setSearchQuery(event.target.value.trim())}
        aria-describedby="searchQueryText"
        placeholder={placeholderCardName}
      />
    </>
  );
};
