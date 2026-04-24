/**
 * This module contains a component which allows the user to select between
 * different card versions while seeing them all at once.
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
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { useDebounce } from "use-debounce";

import { ExploreDebounceMS, Printing } from "@/common/constants";
import { SortBy } from "@/common/schema_types";
import {
  CardDocument,
  FilterSettings,
  SourceSettings,
  useAppSelector,
} from "@/common/types";
import { Blurrable } from "@/components/Blurrable";
import { OverflowCol } from "@/components/OverflowCol";
import { Spinner } from "@/components/Spinner";
import { CardResultSet } from "@/features/card/CardResultSet";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import { GridSelectorFilters } from "@/features/gridSelector/GridSelectorFilters";
import { GenericErrorPage } from "@/features/ui/GenericErrorPage";
import { selectCardDocumentsByIdentifiers } from "@/store/slices/cardDocumentsSlice";
import { selectFavoriteIdentifiersSet } from "@/store/slices/favoritesSlice";
import {
  getDefaultSearchSettings,
  selectSearchSettings,
} from "@/store/slices/searchSettingsSlice";
import { selectSourceDocuments } from "@/store/slices/sourceDocumentsSlice";

const HeightDelta = 200;

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

  const { clientSearchService } = useClientSearchContext();

  const favoriteIdentifiersSet = useAppSelector(selectFavoriteIdentifiersSet);
  const globalSearchSettings = useAppSelector(selectSearchSettings);
  const cardDocumentsByIdentifier = useAppSelector((state) =>
    selectCardDocumentsByIdentifiers(state, imageIdentifiers)
  );
  const sourceDocuments = useAppSelector(selectSourceDocuments);

  //# endregion

  //# region state

  const [settingsVisible, setSettingsVisible] = useState<boolean>(true);
  const focusRef = useRef<HTMLInputElement>(null);

  const [filterSettings, setFilterSettings] = useState<FilterSettings>(
    globalSearchSettings.filterSettings
  );
  const [sourceSettings, setSourceSettings] = useState<SourceSettings>(
    globalSearchSettings.sourceSettings
  );
  const [sortBy, setSortBy] = useState<SortBy | undefined>(undefined);
  const [filteredIdentifiers, setFilteredIdentifiers] =
    useState<Array<string>>(imageIdentifiers);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);
  const [artists, setArtists] = useState<Array<string>>([]);
  const [printings, setPrintings] = useState<Array<Printing>>([]);

  const selectImage = useCallback(
    (identifier: string) => {
      onClick(identifier);
      handleClose();
    },
    [onClick, handleClose]
  );

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
      setSortBy(undefined);
      setArtists([]);
      setPrintings([]);
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

  const displaySpinner = debouncedFilterState.isPending() || isFiltering;

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

  const noSearchResults =
    sortedFilteredIdentifiers.length === 0 && !displaySpinner;

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
            <OverflowCol
              lg={3}
              sm={4}
              xs={6}
              className="border-end p-0"
              heightDelta={HeightDelta}
            >
              <GridSelectorFilters
                imageIdentifiers={imageIdentifiers}
                focusRef={focusRef}
                selectImage={selectImage}
                sortBy={sortBy}
                setSortBy={setSortBy}
                printings={printings}
                setPrintings={setPrintings}
                artists={artists}
                setArtists={setArtists}
                filterSettings={filterSettings}
                setFilterSettings={setFilterSettings}
                sourceSettings={sourceSettings}
                setSourceSettings={setSourceSettings}
                projectFilter={projectFilter}
              />
            </OverflowCol>
          )}
          <OverflowCol
            lg={settingsVisible ? 9 : 12}
            sm={settingsVisible ? 8 : 12}
            xs={settingsVisible ? 6 : 12}
            className="p-0"
            heightDelta={HeightDelta}
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
              />
            </Blurrable>
            {noSearchResults && (
              <GenericErrorPage
                title="No results :("
                text={["Your filters didn't match any results."]}
              />
            )}
          </OverflowCol>
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
