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
import { TreeNode } from "react-dropdown-tree-select";
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
import { Blurrable } from "@/components/Blurrable";
import { RightPaddedIcon } from "@/components/icon";
import { Spinner } from "@/components/Spinner";
import {
  CardResultSet,
  FAVORITES_SOURCE_KEY,
} from "@/features/card/CardResultSet";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import { GridSelectorSortBy } from "@/features/clientSearch/clientSearchService";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/FilterSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/SourceSettings";
import { selectCardDocumentsByIdentifiers } from "@/store/slices/cardDocumentsSlice";
import { selectFavoriteIdentifiersSet } from "@/store/slices/favoritesSlice";
import {
  getDefaultSearchSettings,
  selectSearchSettings,
} from "@/store/slices/searchSettingsSlice";
import {
  selectSourceDocuments,
  selectSourceNamesByKey,
} from "@/store/slices/sourceDocumentsSlice";
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

const GridSelectorSortByOptions: Record<GridSelectorSortBy, string> = {
  source: "Source",
  ...SortByOptions,
};

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
  /** When false, ignore project-level search settings and use unconstrained defaults instead. */
  applySearchSettings?: boolean;
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
  applySearchSettings = true,
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
  const sourceDocuments = useAppSelector(selectSourceDocuments);

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
  const [sortBy, setSortBy] = useState<GridSelectorSortBy>("source");
  const [filteredIdentifiers, setFilteredIdentifiers] =
    useState<Array<string>>(imageIdentifiers);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);
  const [compressed, setCompressed] = useState<boolean>(true);
  const [artists, setArtists] = useState<Array<string>>([]);
  const [printings, setPrintings] = useState<Array<string>>([]);
  const [expandedPrintingNodes, setExpandedPrintingNodes] = useState<
    Array<string>
  >([]);

  //# endregion

  //# region debouncing

  function equalityFn<T>(left: T, right: T): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  const [debouncedFilter, debouncedFilterState] = useDebounce(
    { filterSettings, sourceSettings, sortBy, artists, printings },
    ExploreDebounceMS,
    { equalityFn }
  );

  //# endregion

  //# region effects

  // Re-initialise local settings from global search settings each time the modal opens
  const globalSearchSettingsRef = useRef(globalSearchSettings);
  globalSearchSettingsRef.current = globalSearchSettings;
  const sourceDocumentsRef = useRef(sourceDocuments);
  sourceDocumentsRef.current = sourceDocuments;
  useEffect(() => {
    if (show) {
      if (applySearchSettings) {
        const settings = globalSearchSettingsRef.current;
        setFilterSettings(settings.filterSettings);
        // Only expose sources that are enabled at the project level
        setSourceSettings({
          sources: settings.sourceSettings.sources.filter(
            ([, enabled]) => enabled
          ),
        });
      } else {
        const defaults = getDefaultSearchSettings(
          sourceDocumentsRef.current ?? {}
        );
        setFilterSettings(defaults.filterSettings);
        setSourceSettings(defaults.sourceSettings);
      }
      setSortBy("source");
      setArtists([]);
      setPrintings([]);
      setExpandedPrintingNodes([]);
    }
  }, [show, applySearchSettings]); // intentionally only re-initialise on show toggle, not on every global settings change

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
        debouncedFilter.sortBy,
        debouncedFilter.artists,
        debouncedFilter.printings
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
      Object.entries(GridSelectorSortByOptions).map(([value, label]) => ({
        value,
        label,
        checked: value === sortBy,
      })),
    [sortBy]
  );

  const sourceKeys = [FAVORITES_SOURCE_KEY, ...Object.keys(sourceNamesByKey)];

  const columnMaxHeight = `calc(100vh - ${ModalChromeHeight}px)`;

  const displaySpinner = debouncedFilterState.isPending() || isFiltering;

  const UNKNOWN_FILTER_VALUE = "Unknown";

  const availableArtists = useMemo(() => {
    const artistSet = new Set<string>();
    let hasUnknown = false;
    Object.values(cardDocumentsByIdentifier).forEach((card) => {
      if (card == null) return;
      if (card.canonicalCard == null) {
        hasUnknown = true;
      } else {
        artistSet.add(card.canonicalCard.artist);
      }
    });
    const sorted = Array.from(artistSet).sort();
    if (hasUnknown) sorted.push(UNKNOWN_FILTER_VALUE);
    return sorted;
  }, [cardDocumentsByIdentifier]);

  // Stable structure: expansion -> { name, collector numbers }; only recomputes when card documents change
  const availablePrintingExpansions = useMemo(() => {
    const expansionMap = new Map<
      string,
      { name: string; numbers: Set<string> }
    >();
    let hasUnknown = false;
    Object.values(cardDocumentsByIdentifier).forEach((card) => {
      if (card == null) return;
      if (card.canonicalCard == null) {
        hasUnknown = true;
      } else {
        const { expansionCode, expansionName, collectorNumber } =
          card.canonicalCard;
        if (!expansionMap.has(expansionCode)) {
          expansionMap.set(expansionCode, {
            name: expansionName,
            numbers: new Set(),
          });
        }
        expansionMap.get(expansionCode)!.numbers.add(collectorNumber);
      }
    });
    return { expansionMap, hasUnknown };
  }, [cardDocumentsByIdentifier]);

  // Tree node data for the dropdown, recomputed when checked/expanded state changes
  const availablePrintingOptions = useMemo(() => {
    const { expansionMap, hasUnknown } = availablePrintingExpansions;
    const nodes = Array.from(expansionMap.entries())
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([expansionCode, { name, numbers }]) => ({
        label: `${name} [${expansionCode.toUpperCase()}]`,
        value: expansionCode,
        checked: printings.includes(expansionCode),
        expanded: expandedPrintingNodes.includes(expansionCode),
        children: Array.from(numbers)
          .sort()
          .map((collectorNumber) => ({
            label: collectorNumber,
            value: `${expansionCode} ${collectorNumber}`,
            checked: printings.includes(`${expansionCode} ${collectorNumber}`),
          })),
      }));
    if (hasUnknown) {
      nodes.push({
        label: UNKNOWN_FILTER_VALUE,
        value: UNKNOWN_FILTER_VALUE,
        checked: printings.includes(UNKNOWN_FILTER_VALUE),
        expanded: false,
        children: [],
      });
    }
    return nodes;
  }, [availablePrintingExpansions, printings, expandedPrintingNodes]);

  const onPrintingNodeToggle = useCallback(
    (currentNode: TreeNode): void => {
      if (
        currentNode.expanded &&
        !expandedPrintingNodes.includes(currentNode.value)
      ) {
        setExpandedPrintingNodes([...expandedPrintingNodes, currentNode.value]);
      } else if (
        !currentNode.expanded &&
        expandedPrintingNodes.includes(currentNode.value)
      ) {
        setExpandedPrintingNodes(
          expandedPrintingNodes.filter((v) => v !== currentNode.value)
        );
      }
    },
    [expandedPrintingNodes]
  );

  // Constraints derived from the project-level search settings (only applied when applySearchSettings is true)
  const projectFilter = applySearchSettings
    ? globalSearchSettings.filterSettings
    : undefined;
  const allowedLanguages =
    projectFilter && projectFilter.languages.length > 0
      ? projectFilter.languages
      : undefined;

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
              <h5>View Settings</h5>
              <h6>Show All Cards...</h6>
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
              <h6 className="mt-2">Card Display</h6>
              <Toggle
                onClick={() => setCompressed((v) => !v)}
                on="Compressed"
                onClassName="flex-centre"
                off="Relaxed"
                offClassName="flex-centre"
                onstyle="info"
                offstyle="success"
                width={100 + "%"}
                size="md"
                height={ToggleButtonHeight + "px"}
                active={compressed}
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
                  setSortBy(currentNode.value as GridSelectorSortBy)
                }
                mode="radioSelect"
                inlineSearchInput
              />
              <hr />
              <FilterSettingsElement
                filterSettings={filterSettings}
                setFilterSettings={setFilterSettings}
                minDPI={projectFilter?.minimumDPI}
                maxDPI={projectFilter?.maximumDPI}
                maxSize={projectFilter?.maximumSize}
                allowedLanguages={allowedLanguages}
              />
              {(availableArtists.length > 0 ||
                availablePrintingOptions.length > 0) && (
                <>
                  <hr />
                  <h5>Canonical Card</h5>
                  {availableArtists.length > 0 && (
                    <>
                      <Form.Label>Artist</Form.Label>
                      <StyledDropdownTreeSelect
                        data={availableArtists.map((artist) => ({
                          label: artist,
                          value: artist,
                          checked: artists.includes(artist),
                        }))}
                        onChange={(_currentNode, selectedNodes) =>
                          setArtists(selectedNodes.map((node) => node.value))
                        }
                        inlineSearchInput
                      />
                    </>
                  )}
                  {availablePrintingOptions.length > 0 && (
                    <>
                      <Form.Label>Card Printing</Form.Label>
                      <StyledDropdownTreeSelect
                        data={availablePrintingOptions}
                        onChange={(_currentNode, selectedNodes) => {
                          const rawValues = selectedNodes.map(
                            (node) => node.value
                          );
                          const normalized = new Set(rawValues);
                          const { expansionMap } = availablePrintingExpansions;
                          for (const value of rawValues) {
                            const expansion = expansionMap.get(value);
                            if (expansion) {
                              for (const collectorNumber of expansion.numbers) {
                                normalized.add(`${value} ${collectorNumber}`);
                              }
                            }
                          }
                          setPrintings(Array.from(normalized));
                        }}
                        onNodeToggle={onPrintingNodeToggle}
                        inlineSearchInput
                      />
                    </>
                  )}
                </>
              )}
              <hr />
              <SourceSettingsElement
                sourceSettings={sourceSettings}
                setSourceSettings={setSourceSettings}
                enableReorderingSources={sortBy === "source"}
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
            <Blurrable disabled={displaySpinner}>
              <CardResultSet
                imageIdentifiers={sortedFilteredIdentifiers}
                handleClick={selectImage}
                selectedImage={selectedImage}
                favoriteIdentifiers={favoriteIdentifiersInFilteredResults}
                originalIndexMap={originalIndexMap}
                compressed={compressed}
              />
            </Blurrable>
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
