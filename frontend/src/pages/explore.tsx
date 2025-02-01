import Head from "next/head";
import React, { useEffect, useState } from "react";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import styled from "styled-components";
import { useDebounce } from "use-debounce";

import { Card, NavbarHeight, RibbonHeight } from "@/common/constants";
import { processPrefix } from "@/common/processing";
import {
  FilterSettings,
  SearchSettings,
  SearchTypeSettings,
  SourceSettings,
  useAppSelector,
} from "@/common/types";
import { NoBackendDefault } from "@/components/NoBackendDefault";
import { OverflowCol } from "@/components/OverflowCol";
import { Spinner } from "@/components/Spinner";
import { DatedCard } from "@/features/card/Card";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/FilterSettings";
import { SearchTypeSettings as SearchTypeSettingsElement } from "@/features/searchSettings/SearchTypeSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/SourceSettings";
import { ProjectContainer } from "@/features/ui/Layout";
import { useGetSampleCardsQuery } from "@/store/api";
import { usePostExploreSearchQuery } from "@/store/api";
import { useBackendConfigured } from "@/store/slices/backendSlice";
import {
  getDefaultSearchSettings,
  getDefaultSourceSettings,
} from "@/store/slices/SearchSettingsSlice";
import { selectSourceDocuments } from "@/store/slices/sourceDocumentsSlice";

interface BlurrableRowProps {
  disabled?: boolean;
}

export const BlurrableRow = styled(Row)<BlurrableRowProps>`
  filter: ${(props) => (props.disabled === true ? "blur(8px)" : undefined)};
  pointer-events: ${(props) => (props.disabled === true ? "none" : undefined)};
`;

function ExploreOrDefault() {
  // TODO: investigate performance of below
  const maybeSourceDocuments = useAppSelector(selectSourceDocuments); // TODO: race condition
  const [query, setQuery] = useState<string>("");
  const defaultSettings = getDefaultSearchSettings(maybeSourceDocuments ?? []);
  const [localSearchTypeSettings, setLocalSearchTypeSettings] =
    useState<SearchTypeSettings>(defaultSettings.searchTypeSettings);
  const [localSourceSettings, setLocalSourceSettings] =
    useState<SourceSettings>(defaultSettings.sourceSettings);
  const [localFilterSettings, setLocalFilterSettings] =
    useState<FilterSettings>(defaultSettings.filterSettings);
  const searchSettings: SearchSettings | undefined =
    maybeSourceDocuments !== undefined
      ? {
          searchTypeSettings: localSearchTypeSettings,
          filterSettings: localFilterSettings,
          sourceSettings: localSourceSettings,
        }
      : undefined;
  useEffect(() => {
    // alert("effectin")
    if (maybeSourceDocuments !== undefined) {
      setLocalSourceSettings(getDefaultSourceSettings(maybeSourceDocuments));
    }
  }, [maybeSourceDocuments]);

  const [debouncedQuery, debouncedQueryState] = useDebounce(query, 700);
  const getSampleCardsQuery = useGetSampleCardsQuery();
  const placeholderCardName =
    getSampleCardsQuery.data != null &&
    (getSampleCardsQuery.data ?? {})[Card][0] != null
      ? getSampleCardsQuery.data[Card][0].name
      : "";

  const postExploreSearchQuery = usePostExploreSearchQuery({
    searchSettings,
    query: processPrefix(debouncedQuery),
  });
  const resultCount = postExploreSearchQuery.data?.count ?? 0;
  const displaySpinner =
    debouncedQueryState.isPending() || postExploreSearchQuery.isFetching;

  const backendConfigured = useBackendConfigured();
  return backendConfigured ? (
    <>
      <Row className="g-0">
        <OverflowCol
          lg={4}
          md={4}
          sm={6}
          xs={6}
          style={{ zIndex: 1 }}
          className="px-2"
        >
          <Form.Label htmlFor="searchQueryText">Search Query</Form.Label>
          <Form.Control
            onChange={(event) => setQuery(event.target.value.trim())}
            aria-describedby="searchQueryText"
            placeholder={placeholderCardName}
          />
          <hr />
          <SearchTypeSettingsElement
            searchTypeSettings={localSearchTypeSettings}
            setSearchTypeSettings={setLocalSearchTypeSettings}
            enableFiltersApplyToCardbacks={false}
          />
          <hr />
          <FilterSettingsElement
            filterSettings={localFilterSettings}
            setFilterSettings={setLocalFilterSettings}
          />
          <hr />
          <SourceSettingsElement
            sourceSettings={localSourceSettings}
            setSourceSettings={setLocalSourceSettings}
            enableReorderingSources={false}
          />
        </OverflowCol>

        <OverflowCol
          lg={8}
          md={8}
          sm={6}
          xs={6}
          disabled={displaySpinner}
          scrollable={!displaySpinner}
        >
          {displaySpinner && <Spinner size={6} zIndex={3} />}

          <h3>
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </h3>
          <BlurrableRow
            xxl={4}
            lg={4}
            md={3}
            sm={2}
            xs={2}
            className="g-0"
            disabled={displaySpinner}
          >
            {postExploreSearchQuery.data?.cards?.map((card) => (
              <DatedCard
                cardDocument={card}
                key={`explore-card-${card.identifier}`}
              />
            ))}
          </BlurrableRow>
        </OverflowCol>
      </Row>
    </>
  ) : (
    <NoBackendDefault />
  );
}

export default function Explore() {
  return (
    <ProjectContainer gutter={0}>
      <Head>
        <title>Explore</title>{" "}
        <meta
          name="description"
          // content={`${ProjectName}&apos;'s rich project editor.`}
        />
      </Head>
      <ExploreOrDefault />
    </ProjectContainer>
  );
}
