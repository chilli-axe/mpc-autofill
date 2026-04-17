/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
 * Card versions are faceted by source, and all cards for a source can be temporarily hidden.
 */

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";
import { useDebounce } from "use-debounce";

import {
  ExploreDebounceMS,
  SortByOptions,
  ToggleButtonHeight,
} from "@/common/constants";
import { SortBy } from "@/common/schema_types";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import {
  CardDocument,
  FilterSettings,
  SourceSettings,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { AutofillCollapse } from "@/components/AutofillCollapse";
import { RightPaddedIcon } from "@/components/icon";
import { Spinner } from "@/components/Spinner";
import {
  CardResultSet,
  FAVORITES_SOURCE_KEY,
} from "@/features/card/CardResultSet";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/FilterSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/SourceSettings";
import { selectCardDocumentsByIdentifiers } from "@/store/slices/cardDocumentsSlice";
import { selectFavoriteIdentifiersSet } from "@/store/slices/favoritesSlice";
import { selectSearchSettings } from "@/store/slices/searchSettingsSlice";
import { selectSourceNamesByKey } from "@/store/slices/sourceDocumentsSlice";
import {
  makeAllSourcesInvisible,
  makeAllSourcesVisible,
  selectAnySourcesCollapsed,
  selectFacetBySource,
  selectJumpToVersionVisible,
  toggleFacetBySource,
  toggleJumpToVersionVisible,
} from "@/store/slices/viewSettingsSlice";

// Approximate modal chrome height (header + footer + dialog margins)
const ModalChromeHeight = 200;

interface GridSelectorProps {
  title?: string;
  testId: string;
  imageIdentifiers: Array<string>;
  selectedImage?: string;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
  onClick: {
    (identifier: string): void;
  };
  searchq?: string;
}

export function GridSelectorModal({
  title = "Select Version",
  testId,
  imageIdentifiers,
  selectedImage,
  show,
  handleClose,
  onClick,
  searchq,
}: GridSelectorProps) {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const { clientSearchService } = useClientSearchContext();

  const jumpToVersionVisible = useAppSelector(selectJumpToVersionVisible);
  const favoriteIdentifiersSet = useAppSelector(selectFavoriteIdentifiersSet);
  const globalSearchSettings = useAppSelector(selectSearchSettings);
  const cardDocumentsByIdentifier = useAppSelector((state) =>
    selectCardDocumentsByIdentifiers(state, imageIdentifiers)
  );
  const facetBySource = useAppSelector(selectFacetBySource);
  const sourceNamesByKey = useAppSelector(selectSourceNamesByKey);
  const anySourcesCollapsed = useAppSelector(selectAnySourcesCollapsed);

  //# endregion

  //# region state

  const [settingsVisible, setSettingsVisible] = useState<boolean>(true);
  const [optionNumber, setOptionNumber] = useState<number | undefined>(
    undefined
  );
  const [imageIdentifier, setImageIdentifier] = useState<string>("");
  const focusRef = useRef<HTMLInputElement>(null);

  const [filterSettings, setFilterSettings] = useState<FilterSettings>(
    globalSearchSettings.filterSettings
  );
  const [sourceSettings, setSourceSettings] = useState<SourceSettings>(
    globalSearchSettings.sourceSettings
  );
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.DateCreatedDescending);
  const [filteredIdentifiers, setFilteredIdentifiers] =
    useState<Array<string>>(imageIdentifiers);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);

  //# endregion

  //# region debouncing

  function equalityFn<T>(left: T, right: T): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  const [debouncedFilter, debouncedFilterState] = useDebounce(
    { filterSettings, sourceSettings, sortBy },
    ExploreDebounceMS,
    { equalityFn }
  );

  //# endregion

  //# region effects

  // Re-initialise local settings from global search settings each time the modal opens
  const globalSearchSettingsRef = useRef(globalSearchSettings);
  globalSearchSettingsRef.current = globalSearchSettings;
  useEffect(() => {
    if (show) {
      const settings = globalSearchSettingsRef.current;
      setFilterSettings(settings.filterSettings);
      setSourceSettings(settings.sourceSettings);
      setSortBy(SortBy.DateCreatedDescending);
    }
  }, [show]); // intentionally only re-initialise on show toggle, not on every global settings change

  // Filter and sort identifiers via the worker whenever debounced settings or identifiers change
  useEffect(() => {
    if (!show) return;
    setIsFiltering(true);
    const cards = Object.values(cardDocumentsByIdentifier).filter(
      (card): card is CardDocument => card !== undefined
    );
    clientSearchService
      .filterGridSelectorIdentifiers(
        cards,
        {
          searchTypeSettings:
            globalSearchSettingsRef.current.searchTypeSettings,
          filterSettings: debouncedFilter.filterSettings,
          sourceSettings: debouncedFilter.sourceSettings,
        },
        debouncedFilter.sortBy
      )
      .then((ids) => {
        setFilteredIdentifiers(ids);
        setIsFiltering(false);
      })
      .catch(() => {
        setFilteredIdentifiers(imageIdentifiers);
        setIsFiltering(false);
      });
  }, [show, cardDocumentsByIdentifier, debouncedFilter]);

  //# endregion

  //# region computed constants

  const filteredIdentifiersSet = useMemo(
    () => new Set(filteredIdentifiers),
    [filteredIdentifiers]
  );

  // Filter favorites to only those present in the current filtered results
  const favoriteIdentifiersInFilteredResults = useMemo(
    () =>
      Array.from(favoriteIdentifiersSet).filter((id) =>
        filteredIdentifiersSet.has(id)
      ),
    [favoriteIdentifiersSet, filteredIdentifiersSet]
  );

  // Sort: favorites first, then Orama's sort order within each group
  const sortedFilteredIdentifiers = useMemo(() => {
    const favoriteSet = new Set(favoriteIdentifiersInFilteredResults);
    return [...filteredIdentifiers].sort((a, b) => {
      const aIsFavorite = favoriteSet.has(a);
      const bIsFavorite = favoriteSet.has(b);
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return 0;
    });
  }, [filteredIdentifiers, favoriteIdentifiersInFilteredResults]);

  // Map from identifier to original index (for consistent option numbering)
  const originalIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    imageIdentifiers.forEach((id, index) => map.set(id, index));
    return map;
  }, [imageIdentifiers]);

  // Validation uses original array length and indices
  const versionToJumpToIsValid =
    ((optionNumber ?? 0) > 0 &&
      (optionNumber ?? 0) < imageIdentifiers.length + 1) ||
    (imageIdentifier !== "" && imageIdentifiers.includes(imageIdentifier));

  const sortByOptions = useMemo(
    () =>
      Object.entries(SortByOptions).map(([value, label]) => ({
        value,
        label,
        checked: value === sortBy,
      })),
    [sortBy]
  );

  const sourceKeys = [FAVORITES_SOURCE_KEY, ...Object.keys(sourceNamesByKey)];

  const columnMaxHeight = `calc(100vh - ${ModalChromeHeight}px)`;

  const displaySpinner = debouncedFilterState.isPending() || isFiltering;

  const modalTitle = `${title} — ${filteredIdentifiers.length.toLocaleString()} result${
    filteredIdentifiers.length !== 1 ? "s" : ""
  }`;

  //# endregion

  //# region callbacks

  const selectImage = useCallback(
    (identifier: string) => {
      onClick(identifier);
      handleClose();
    },
    [onClick, handleClose]
  );
  // "Jump to Version" uses original array indices
  const handleSubmitJumpToVersionForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    selectImage(
      optionNumber ? imageIdentifiers[optionNumber - 1] : imageIdentifier
    );
  };

  //# endregion

  return (
    <Modal
      scrollable
      show={show}
      onEntered={() => {
        if (focusRef.current) {
          focusRef.current.focus();
        }
      }}
      onHide={handleClose}
      size="xl"
      data-testid={testId}
    >
      <Modal.Header closeButton>
        <div className="d-flex align-items-center gap-2">
          <Modal.Title>{modalTitle}</Modal.Title>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => setSettingsVisible((v) => !v)}
          >
            <i
              className={`bi bi-chevron-${settingsVisible ? "left" : "right"}`}
            />{" "}
            Filters
          </Button>
        </div>
      </Modal.Header>
      <Modal.Body className="p-0" style={{ overflowY: "hidden" }}>
        <Row className="g-0">
          {settingsVisible && (
            <Col
              lg={3}
              className="border-end px-2 py-2"
              style={{ maxHeight: columnMaxHeight, overflowY: "auto" }}
            >
              <AutofillCollapse
                expanded={jumpToVersionVisible}
                onClick={() => dispatch(toggleJumpToVersionVisible())}
                zIndex={0}
                title={<h4>Jump to Version</h4>}
              >
                <>
                  <Form
                    className="px-3"
                    id="jumpToVersionForm"
                    onSubmit={handleSubmitJumpToVersionForm}
                  >
                    <Row className="g-0">
                      <Col xs={12}>
                        <Form.Label>
                          Specify Option Number, <b>or...</b>
                        </Form.Label>
                        <Form.Control
                          ref={focusRef}
                          type="number"
                          pattern="[0-9]*"
                          placeholder="1"
                          value={optionNumber}
                          onChange={(event) =>
                            setOptionNumber(
                              event.target.value
                                ? parseInt(event.target.value)
                                : undefined
                            )
                          }
                          disabled={Boolean(imageIdentifier)}
                        />
                      </Col>
                      <Col xs={12} className="mt-2">
                        <Form.Label>Specify ID</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder={imageIdentifiers[0]}
                          value={imageIdentifier}
                          onChange={(event) =>
                            setImageIdentifier(event.target.value)
                          }
                          disabled={Boolean(optionNumber)}
                        />
                      </Col>
                    </Row>
                    <div className="d-grid gap-0 pt-3">
                      <Button
                        variant="primary"
                        form="jumpToVersionForm"
                        type="submit"
                        aria-label="jump-to-version-submit"
                        disabled={!versionToJumpToIsValid}
                      >
                        Select This Version
                      </Button>
                    </div>
                  </Form>
                  <hr />
                </>
              </AutofillCollapse>
              <h5>Show All Cards...</h5>
              <Toggle
                onClick={() => dispatch(toggleFacetBySource())}
                on="Grouped By Source"
                onClassName="flex-centre"
                off="Grouped Together"
                offClassName="flex-centre"
                onstyle="success"
                offstyle="info"
                width={100 + "%"}
                size="md"
                height={ToggleButtonHeight + "px"}
                active={facetBySource}
              />
              {facetBySource && (
                <div className="d-grid mt-2">
                  <Button
                    onClick={() =>
                      dispatch(
                        anySourcesCollapsed
                          ? makeAllSourcesVisible()
                          : makeAllSourcesInvisible(sourceKeys)
                      )
                    }
                  >
                    <RightPaddedIcon
                      bootstrapIconName={`arrows-${
                        anySourcesCollapsed ? "expand" : "collapse"
                      }`}
                    />{" "}
                    {anySourcesCollapsed ? "Expand" : "Collapse"} All
                  </Button>
                </div>
              )}
              <hr />
              <h5>Sort By</h5>
              <StyledDropdownTreeSelect
                data={sortByOptions}
                onChange={(currentNode) =>
                  setSortBy(currentNode.value as SortBy)
                }
                mode="radioSelect"
                inlineSearchInput
              />
              <hr />
              <FilterSettingsElement
                filterSettings={filterSettings}
                setFilterSettings={setFilterSettings}
              />
              <hr />
              <SourceSettingsElement
                sourceSettings={sourceSettings}
                setSourceSettings={setSourceSettings}
                enableReorderingSources={false}
              />
            </Col>
          )}
          <Col
            lg={settingsVisible ? 9 : 12}
            className="p-0"
            style={{
              maxHeight: columnMaxHeight,
              overflowY: "auto",
              position: "relative",
            }}
          >
            {displaySpinner && (
              <Spinner size={6} zIndex={3} positionAbsolute={true} />
            )}
            <CardResultSet
              imageIdentifiers={sortedFilteredIdentifiers}
              handleClick={selectImage}
              selectedImage={selectedImage}
              favoriteIdentifiers={favoriteIdentifiersInFilteredResults}
              originalIndexMap={originalIndexMap}
            />
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
