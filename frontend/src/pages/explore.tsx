import Head from "next/head";
import React, { useEffect, useState } from "react";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import styled from "styled-components";
import { useDebounce } from "use-debounce";

import { Card, RibbonHeight } from "@/common/constants";
import { processPrefix } from "@/common/processing";
import {
  FilterSettings,
  SearchTypeSettings,
  SourceSettings,
  useAppSelector,
} from "@/common/types";
import { NoBackendDefault } from "@/components/NoBackendDefault";
import { OverflowCol } from "@/components/OverflowCol";
import { Ribbon } from "@/components/Ribbon";
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

const TYPING_DEBOUNCE_MS = 700;
const SEARCH_SETTING_DEBOUNCE_MS = 300;

function ExploreOrDefault() {
  const maybeSourceDocuments = useAppSelector(selectSourceDocuments);
  const backendConfigured = useBackendConfigured();

  const defaultSettings = getDefaultSearchSettings(maybeSourceDocuments ?? []);

  // input state
  const [query, setQuery] = useState<string>("");
  const [localSearchTypeSettings, setLocalSearchTypeSettings] =
    useState<SearchTypeSettings>(defaultSettings.searchTypeSettings);

  const [localFilterSettings, setLocalFilterSettings] =
    useState<FilterSettings>(defaultSettings.filterSettings);

  const [localSourceSettings, setLocalSourceSettings] =
    useState<SourceSettings>(defaultSettings.sourceSettings);

  // TODO: review this later. check object refs are stable so this triggers predictably.
  useEffect(() => {
    // handle race condition - reconfigure source settings when source documents are accessible.
    if (maybeSourceDocuments !== undefined) {
      setLocalSourceSettings(getDefaultSourceSettings(maybeSourceDocuments));
    }
  }, [maybeSourceDocuments]);

  // debounced state
  function equalityFn<T>(left: T, right: T): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  const [debouncedQuery, debouncedQueryState] = useDebounce(
    query,
    TYPING_DEBOUNCE_MS
  );
  const [
    debouncedLocalSearchTypeSettings,
    debouncedLocalSearchTypeSettingsState,
  ] = useDebounce(localSearchTypeSettings, SEARCH_SETTING_DEBOUNCE_MS, {
    equalityFn,
  });
  const [debouncedLocalFilterSettings, debouncedLocalFilterSettingsState] =
    useDebounce(localFilterSettings, SEARCH_SETTING_DEBOUNCE_MS, {
      equalityFn,
    });
  const [debouncedLocalSourceSettings, debouncedLocalSourceSettingsState] =
    useDebounce(localSourceSettings, SEARCH_SETTING_DEBOUNCE_MS, {
      equalityFn,
    });

  const getSampleCardsQuery = useGetSampleCardsQuery();
  const placeholderCardName =
    getSampleCardsQuery.data != null &&
    (getSampleCardsQuery.data ?? {})[Card][0] != null
      ? getSampleCardsQuery.data[Card][0].name
      : "";

  const postExploreSearchQuery = usePostExploreSearchQuery({
    searchSettings: {
      searchTypeSettings: debouncedLocalSearchTypeSettings,
      filterSettings: debouncedLocalFilterSettings,
      sourceSettings: debouncedLocalSourceSettings,
    },
    query: processPrefix(debouncedQuery),
  });
  const resultCount = postExploreSearchQuery.data?.count ?? 0;
  const displaySpinner =
    debouncedQueryState.isPending() ||
    debouncedLocalSearchTypeSettingsState.isPending() ||
    debouncedLocalSourceSettingsState.isPending() ||
    debouncedLocalFilterSettingsState.isPending() ||
    postExploreSearchQuery.isFetching;

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
          <h5>Search Query</h5>
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

        <Col style={{ position: "relative" }}>
          {displaySpinner && <Spinner size={6} zIndex={3} />}
          <Ribbon className="mx-0">
            {!displaySpinner && (
              <div className="text-center align-content-center">
                <span>
                  <b>{resultCount.toLocaleString()}</b> result
                  {resultCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </Ribbon>
          <OverflowCol
            disabled={displaySpinner}
            scrollable={!displaySpinner}
            heightDelta={RibbonHeight}
          >
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
        </Col>
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
