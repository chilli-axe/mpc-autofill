import React, { useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { useDebounce } from "use-debounce";

import {
  ExploreDebounceMS,
  ExplorePageSize,
  NavbarHeight,
  RibbonHeight,
} from "@/common/constants";
import { ExploreSearchRequest, SortBy } from "@/common/schema_types";
import {
  assertNever,
  BackendType,
  CardDocument,
  CardType,
  FilterSettings,
  SearchSettings,
  SearchTypeSettings,
  SourceSettings,
  useAppSelector,
} from "@/common/types";
import { Blurrable } from "@/components/Blurrable";
import { OverflowCol } from "@/components/OverflowCol";
import { Ribbon } from "@/components/Ribbon";
import { Spinner } from "@/components/Spinner";
import { DatedCard } from "@/features/card/Card";
import { GenericErrorPage } from "@/features/ui/GenericErrorPage";
import { usePostExploreSearchQuery } from "@/store/api";
import {
  getDefaultSearchSettings,
  getDefaultSourceSettings,
} from "@/store/slices/searchSettingsSlice";
import { selectSourceDocuments } from "@/store/slices/sourceDocumentsSlice";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";
import { ExploreFilters } from "./ExploreFilters";

const useExploreSearchResults = (
  exploreSearchRequest: ExploreSearchRequest,
  backendType: BackendType
): { cards: Array<CardDocument>; count: number; isFetching: boolean } => {
  const postExploreSearchQuery =
    usePostExploreSearchQuery(exploreSearchRequest);
  const { clientSearchService } = useClientSearchContext();
  const [localResults, setLocalResults] = useState<{
    cards: Array<CardDocument>;
    count: number;
  }>({ cards: [], count: 0 });
  useEffect(() => {
    if (backendType === "local") {
      clientSearchService
        .exploreSearch(
          exploreSearchRequest.sortBy,
          exploreSearchRequest.query ?? undefined,
          exploreSearchRequest.cardTypes,
          exploreSearchRequest.searchSettings,
          exploreSearchRequest.pageStart,
          exploreSearchRequest.pageSize
        )
        .then(setLocalResults);
    } else {
      setLocalResults({ cards: [], count: 0 });
    }
  }, [exploreSearchRequest, backendType]);

  if (backendType === "remote") {
    return {
      cards: postExploreSearchQuery.data?.cards ?? [],
      count: postExploreSearchQuery.data?.count ?? 0,
      isFetching: postExploreSearchQuery.isFetching,
    };
  }
  if (backendType === "local") {
    return {
      ...localResults,
      isFetching: false,
    };
  }
  return assertNever(backendType);
};

export function Explore() {
  const maybeSourceDocuments = useAppSelector(selectSourceDocuments);

  const defaultSettings: SearchSettings = getDefaultSearchSettings(
    maybeSourceDocuments ?? [],
    true
  );

  // pagination state
  const [pageStart, setPageStart] = useState<number>(0);

  // input state
  const [backendType, setBackendType] = useState<BackendType>("remote");
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.DateCreatedDescending);
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
  const [compressed, setCompressed] = useState<boolean>(false);

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

  const {
    cards,
    count: resultCount,
    isFetching,
  } = useExploreSearchResults(debouncedExploreSearchRequest, backendType);

  // pagination stuff
  const currentPageSize = cards.length ?? 0;
  const multiplePagesExist = resultCount !== currentPageSize;
  const previousPageExists = multiplePagesExist && pageStart > 0;
  const nextPageExists =
    multiplePagesExist && pageStart + ExplorePageSize < resultCount;

  const displaySpinner =
    debouncedExploreSearchRequestState.isPending() || isFetching;
  const noResults = cards?.length === 0 && !displaySpinner;

  return (
    <Row className="g-0">
      <OverflowCol
        lg={4}
        md={4}
        sm={6}
        xs={6}
        style={{ zIndex: 1 }}
        className="px-2"
        heightDelta={NavbarHeight}
      >
        <ExploreFilters
          compressed={compressed}
          setCompressed={setCompressed}
          backendType={backendType}
          setBackendType={setBackendType}
          sortBy={sortBy}
          setSortBy={setSortByAndResetPageStart}
          searchQuery={query}
          setSearchQuery={setQueryAndResetPageStart}
          cardTypes={cardTypes}
          setCardTypes={setCardTypesAndResetPageStart}
          searchTypeSettings={searchTypeSettings}
          setSearchTypeSettings={setSearchTypeSettingsAndResetPageStart}
          filterSettings={filterSettings}
          setFilterSettings={setFilterSettingsAndResetPageStart}
          sourceSettings={sourceSettings}
          setSourceSettings={setSourceSettingsAndResetPageStart}
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
          heightDelta={RibbonHeight + NavbarHeight}
        >
          <Blurrable disabled={displaySpinner}>
            <Row xxl={4} lg={3} md={2} sm={1} xs={1} className="g-0">
              {cards?.map((card) => (
                <DatedCard
                  cardDocument={card}
                  headerDate={
                    sortBy === SortBy.DateModifiedAscending ||
                    sortBy === SortBy.DateModifiedDescending
                      ? "modified"
                      : "created"
                  }
                  key={`explore-card-${card.identifier}`}
                  compressed={compressed}
                />
              ))}
            </Row>
          </Blurrable>
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
  );
}
