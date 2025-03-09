import React, { useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { useDebounce } from "use-debounce";

import {
  Card,
  CardTypePrefixes,
  ExploreDebounceMS,
  ExplorePageSize,
  RibbonHeight,
  SortByOptions,
} from "@/common/constants";
import { ExploreSearchRequest, SortBy } from "@/common/schema_types";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import {
  CardType,
  FilterSettings,
  SearchSettings,
  SearchTypeSettings,
  SourceSettings,
  useAppSelector,
} from "@/common/types";
import { BlurrableRow } from "@/components/BlurrableRow";
import { NoBackendDefault } from "@/components/NoBackendDefault";
import { OverflowCol } from "@/components/OverflowCol";
import { Ribbon } from "@/components/Ribbon";
import { Spinner } from "@/components/Spinner";
import { DatedCard } from "@/features/card/Card";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/FilterSettings";
import { SearchTypeSettings as SearchTypeSettingsElement } from "@/features/searchSettings/SearchTypeSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/SourceSettings";
import { GenericErrorPage } from "@/features/ui/GenericErrorPage";
import { useGetSampleCardsQuery, usePostExploreSearchQuery } from "@/store/api";
import { useBackendConfigured } from "@/store/slices/backendSlice";
import {
  getDefaultSearchSettings,
  getDefaultSourceSettings,
} from "@/store/slices/searchSettingsSlice";
import { selectSourceDocuments } from "@/store/slices/sourceDocumentsSlice";

export function Explore() {
  const maybeSourceDocuments = useAppSelector(selectSourceDocuments);
  const backendConfigured = useBackendConfigured();

  const defaultSettings: SearchSettings = getDefaultSearchSettings(
    maybeSourceDocuments ?? [],
    true
  );

  // pagination state
  const [pageStart, setPageStart] = useState<number>(0);

  // input state
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.DateDescending);
  const [query, setQuery] = useState<string>("");
  const [cardTypes, setCardTypes] = useState<Array<CardType>>([]);
  const [searchTypeSettings, setSearchTypeSettings] =
    useState<SearchTypeSettings>(defaultSettings.searchTypeSettings);

  const [filterSettings, setFilterSettings] = useState<FilterSettings>(
    defaultSettings.filterSettings
  );

  const [sourceSettings, setSourceSettings] = useState<SourceSettings>(
    defaultSettings.sourceSettings
  );

  // ensure pagination is reset when any filters change
  function updateInputAndResetPageStart<T>(setter: { (value: T): void }) {
    return (value: T): void => {
      setPageStart(0);
      setter(value);
    };
  }
  const setSortByAndResetPageStart = updateInputAndResetPageStart(setSortBy);
  const setQueryAndResetPageStart = updateInputAndResetPageStart(setQuery);
  const setCardTypesAndResetPageStart =
    updateInputAndResetPageStart(setCardTypes);
  const setSearchTypeSettingsAndResetPageStart = updateInputAndResetPageStart(
    setSearchTypeSettings
  );
  const setFilterSettingsAndResetPageStart =
    updateInputAndResetPageStart(setFilterSettings);
  const setSourceSettingsAndResetPageStart =
    updateInputAndResetPageStart(setSourceSettings);

  // TODO: review this later. check redux object refs are stable so this triggers predictably.
  useEffect(() => {
    // handle race condition - reconfigure source settings when source documents are accessible.
    if (maybeSourceDocuments !== undefined) {
      setSourceSettings(getDefaultSourceSettings(maybeSourceDocuments));
    }
  }, [maybeSourceDocuments]);

  const getSampleCardsQuery = useGetSampleCardsQuery();
  const placeholderCardName =
    getSampleCardsQuery.data != null &&
    (getSampleCardsQuery.data ?? {})[Card][0] != null
      ? getSampleCardsQuery.data[Card][0].name
      : "";

  const exploreSearchRequest: ExploreSearchRequest = {
    sortBy,
    searchSettings: {
      searchTypeSettings: searchTypeSettings,
      filterSettings: filterSettings,
      sourceSettings: sourceSettings,
    },
    query,
    cardTypes,
    pageStart,
    pageSize: ExplorePageSize,
  };
  // debounced filters to avoid spamming webserver
  function equalityFn<T>(left: T, right: T): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  const [debouncedExploreSearchRequest, debouncedExploreSearchRequestState] =
    useDebounce(exploreSearchRequest, ExploreDebounceMS, { equalityFn });

  const postExploreSearchQuery = usePostExploreSearchQuery(
    debouncedExploreSearchRequest
  );

  // pagination stuff
  const resultCount = postExploreSearchQuery.data?.count ?? 0;
  const currentPageSize = postExploreSearchQuery.data?.cards?.length ?? 0;
  const multiplePagesExist = resultCount !== currentPageSize;
  const previousPageExists = multiplePagesExist && pageStart > 0;
  const nextPageExists =
    multiplePagesExist && pageStart + ExplorePageSize < resultCount;

  const displaySpinner =
    debouncedExploreSearchRequestState.isPending() ||
    postExploreSearchQuery.isFetching;
  const noResults =
    postExploreSearchQuery.data?.cards?.length === 0 && !displaySpinner;

  // form stuff
  const sortByOptions = useMemo(
    () =>
      Object.entries(SortByOptions).map(([value, label]) => ({
        value,
        label,
        checked: value === sortBy,
      })),
    [sortBy]
  );

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
          <h5>Sort By</h5>
          <StyledDropdownTreeSelect
            data={sortByOptions}
            onChange={(currentNode, selectedNodes) =>
              setSortByAndResetPageStart(currentNode.value as SortBy)
            }
            mode="radioSelect"
            inlineSearchInput
          />
          <hr />
          <h5>Search Query</h5>
          <Form.Control
            onChange={(event) =>
              setQueryAndResetPageStart(event.target.value.trim())
            }
            aria-describedby="searchQueryText"
            placeholder={placeholderCardName}
          />
          <Form.Label htmlFor="selectTypes">
            Select which card types to include
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
                selectedNodes.map((item) => item.value as CardType)
              )
            }
            inlineSearchInput
          />
          <hr />
          <SearchTypeSettingsElement
            searchTypeSettings={searchTypeSettings}
            setSearchTypeSettings={setSearchTypeSettingsAndResetPageStart}
            enableFiltersApplyToCardbacks={false}
          />
          <hr />
          <FilterSettingsElement
            filterSettings={filterSettings}
            setFilterSettings={setFilterSettingsAndResetPageStart}
          />
          <hr />
          <SourceSettingsElement
            sourceSettings={sourceSettings}
            setSourceSettings={setSourceSettingsAndResetPageStart}
            enableReorderingSources={false}
          />
        </OverflowCol>

        <Col style={{ position: "relative" }} lg={8} md={8} sm={6} xs={6}>
          {displaySpinner && (
            <Spinner size={6} zIndex={3} positionAbsolute={true} />
          )}
          {noResults && (
            <GenericErrorPage
              title="No results :("
              text={["Your search didn't match any results."]}
            />
          )}
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
                  setPageStart((value) => Math.max(value - ExplorePageSize, 0))
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
                    Math.min(value + ExplorePageSize, resultCount)
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
