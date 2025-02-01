import Head from "next/head";
import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { TreeNode } from "react-dropdown-tree-select";
import styled from "styled-components";
import { useDebounce } from "use-debounce";

import { Card, CardTypePrefixes, RibbonHeight } from "@/common/constants";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
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
const PAGE_SIZE = 60;

function ExploreOrDefault() {
  const maybeSourceDocuments = useAppSelector(selectSourceDocuments);
  const backendConfigured = useBackendConfigured();

  const defaultSettings = getDefaultSearchSettings(maybeSourceDocuments ?? []);

  // pagination state
  const [pageStart, setPageStart] = useState<number>(0);

  // input state
  const [query, setQuery] = useState<string>("");
  const [cardTypes, setCardTypes] = useState<Array<string>>([]);
  const [localSearchTypeSettings, setLocalSearchTypeSettings] =
    useState<SearchTypeSettings>(defaultSettings.searchTypeSettings);

  const [localFilterSettings, setLocalFilterSettings] =
    useState<FilterSettings>(defaultSettings.filterSettings);

  const [localSourceSettings, setLocalSourceSettings] =
    useState<SourceSettings>(defaultSettings.sourceSettings);

  function updateInputAndResetPageStart<T>(setter: { (value: T): void }) {
    return (value: T): void => {
      setPageStart(0);
      setter(value);
    };
  }
  const setQueryAndResetPageStart = updateInputAndResetPageStart(setQuery);
  const setCardTypesAndResetPageStart =
    updateInputAndResetPageStart(setCardTypes);
  const setLocalSearchTypeSettingsAndResetPageStart =
    updateInputAndResetPageStart(setLocalSearchTypeSettings);
  const setLocalFilterSettingsAndResetPageStart = updateInputAndResetPageStart(
    setLocalFilterSettings
  );
  const setLocalSourceSettingsAndResetPageStart = updateInputAndResetPageStart(
    setLocalSourceSettings
  );

  // TODO: review this later. check object refs are stable so this triggers predictably.
  useEffect(() => {
    // handle race condition - reconfigure source settings when source documents are accessible.
    if (maybeSourceDocuments !== undefined) {
      setLocalSourceSettings(getDefaultSourceSettings(maybeSourceDocuments));
    }
  }, [maybeSourceDocuments]);

  // debounced state
  // TODO: consider rolling these all up into one object
  function equalityFn<T>(left: T, right: T): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  const [debouncedPageStart, debouncedPageStartState] = useDebounce(
    pageStart,
    SEARCH_SETTING_DEBOUNCE_MS
  );
  const [debouncedQuery, debouncedQueryState] = useDebounce(
    query,
    TYPING_DEBOUNCE_MS
  );
  const [debouncedCardTypes, debouncedCardTypesState] = useDebounce(
    cardTypes,
    SEARCH_SETTING_DEBOUNCE_MS,
    { equalityFn }
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
    query: debouncedQuery,
    cardTypes: debouncedCardTypes,
    pageStart: debouncedPageStart,
    pageSize: PAGE_SIZE,
  });
  const resultCount = postExploreSearchQuery.data?.count ?? 0;
  const currentPageSize = postExploreSearchQuery.data?.cards?.length ?? 0;
  const multiplePagesExist = resultCount !== currentPageSize;
  const previousPageExists = multiplePagesExist && pageStart > 0;
  const nextPageExists =
    multiplePagesExist && pageStart + PAGE_SIZE < resultCount;

  const displaySpinner =
    debouncedPageStartState.isPending() ||
    debouncedQueryState.isPending() ||
    debouncedCardTypesState.isPending() ||
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
            onChange={(event) =>
              setQueryAndResetPageStart(event.target.value.trim())
            }
            aria-describedby="searchQueryText"
            placeholder={placeholderCardName}
          />
          <Form.Label htmlFor="selectTags">
            Select tags which card types to include
          </Form.Label>
          <StyledDropdownTreeSelect
            data={Object.values(CardTypePrefixes).map((cardType) => ({
              label:
                cardType[0].toUpperCase() + cardType.slice(1).toLowerCase(),
              value: cardType,
              checked: cardTypes.includes(cardType),
            }))}
            onChange={(currentNode, selectedNodes) =>
              setCardTypesAndResetPageStart(
                selectedNodes.map((item) => item.value)
              )
            }
          />
          <hr />
          <SearchTypeSettingsElement
            searchTypeSettings={localSearchTypeSettings}
            setSearchTypeSettings={setLocalSearchTypeSettingsAndResetPageStart}
            enableFiltersApplyToCardbacks={false}
          />
          <hr />
          <FilterSettingsElement
            filterSettings={localFilterSettings}
            setFilterSettings={setLocalFilterSettingsAndResetPageStart}
          />
          <hr />
          <SourceSettingsElement
            sourceSettings={localSourceSettings}
            setSourceSettings={setLocalSourceSettingsAndResetPageStart}
            enableReorderingSources={false}
          />
        </OverflowCol>

        <Col style={{ position: "relative" }} lg={8} md={8} sm={6} xs={6}>
          {displaySpinner && <Spinner size={6} zIndex={3} />}
          <OverflowCol
            disabled={displaySpinner}
            scrollable={!displaySpinner}
            heightDelta={RibbonHeight}
          >
            <BlurrableRow
              xxl={4}
              lg={3}
              md={2}
              sm={1}
              xs={1}
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
          <Ribbon className="mx-0" position="bottom">
            <div className="text-center align-content-center position-relative">
              <Button
                variant="outline-info"
                className="position-absolute top-50 start-0 translate-middle-y ms-1"
                disabled={!previousPageExists}
                onClick={() =>
                  setPageStart((value) => Math.max(value - PAGE_SIZE, 0))
                }
              >
                &#10094;
              </Button>
              {!displaySpinner && (
                <span>
                  {multiplePagesExist && (
                    <>
                      <b>{(pageStart + 1).toLocaleString()}</b> —
                      <b>{(pageStart + currentPageSize).toLocaleString()}</b> of{" "}
                    </>
                  )}
                  <b>{resultCount.toLocaleString()}</b> result
                  {resultCount !== 1 ? "s" : ""}
                </span>
              )}
              <Button
                variant="outline-info"
                className="position-absolute top-50 end-0 translate-middle-y"
                disabled={!nextPageExists}
                onClick={() =>
                  setPageStart((value) =>
                    Math.min(value + PAGE_SIZE, resultCount)
                  )
                }
              >
                &#10095;
              </Button>
            </div>
          </Ribbon>
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
