import {
  addListener,
  createListenerMiddleware,
  isAnyOf,
} from "@reduxjs/toolkit";

import { Back, Front, QueryTags } from "@/common/constants";
import {
  getLocalStorageFavorites,
  getLocalStorageSearchSettings,
  setLocalStorageFavorites,
} from "@/common/cookies";
import { Faces } from "@/common/types";
import { Tag } from "@/common/types";
import { localFilesService } from "@/features/localFiles/localFilesService";
import { api } from "@/store/api";
import {
  clearURL,
  selectRemoteBackendConfigured,
  setURL,
} from "@/store/slices/backendSlice";
import {
  fetchCardbacks,
  fetchCardbacksAndReportError,
  selectCardbacks,
} from "@/store/slices/cardbackSlice";
import { fetchCardDocumentsAndReportError } from "@/store/slices/cardDocumentsSlice";
import {
  clearFavoriteRenders,
  removeFavoriteRender,
  setAllFavoriteRenders,
  setFavoriteRender,
  toggleFavoriteRender,
} from "@/store/slices/favoritesSlice";
import { recordInvalidIdentifier } from "@/store/slices/invalidIdentifiersSlice";
import {
  addMembers,
  selectProjectCardback,
  setQueries,
  setSelectedCardback,
  setSelectedImages,
} from "@/store/slices/projectSlice";
import {
  clearSearchResults,
  fetchSearchResults,
  selectSearchResultsForQueryOrDefault,
} from "@/store/slices/searchResultsSlice";
import {
  setFilterSettings,
  setSearchTypeSettings,
  setSourceSettings,
} from "@/store/slices/searchSettingsSlice";
import {
  fetchSourceDocuments,
  fetchSourceDocumentsAndReportError,
  selectSourceDocuments,
} from "@/store/slices/sourceDocumentsSlice";

import type { AppDispatch, RootState } from "./store";

export const recalculateSearchResults = async (
  state: RootState,
  dispatch: AppDispatch,
  refreshCardbacks: boolean
) => {
  dispatch(clearSearchResults());
  await fetchCardDocumentsAndReportError(dispatch, {
    refreshCardbacks,
  });
};

//# region boilerplate

export const listenerMiddleware = createListenerMiddleware();

const startAppListening = listenerMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>();

const addAppListener = addListener.withTypes<RootState, AppDispatch>();

//# endregion

//# region listeners

startAppListening({
  actionCreator: setURL,
  /**
   * Fetch sources and load favorites from localStorage whenever the backend configuration is set.
   */
  effect: async (action, { getState, dispatch }) => {
    const state = getState();
    const isRemoteBackendConfigured = selectRemoteBackendConfigured(state);
    if (isRemoteBackendConfigured) {
      await fetchSourceDocumentsAndReportError(dispatch).then(() =>
        fetchCardbacksAndReportError(dispatch)
      );
      // Load favorites from localStorage on app initialization
      const favorites = getLocalStorageFavorites();
      if (Object.keys(favorites).length > 0) {
        dispatch(setAllFavoriteRenders(favorites));
      }
    }
  },
});

startAppListening({
  actionCreator: fetchSourceDocuments.fulfilled,
  /**
   * Populate search settings in the Redux store from search settings
   * whenever the list of sources changes.
   */
  effect: async (action, { getState, dispatch }) => {
    const state = getState();
    const maybeSourceDocuments = selectSourceDocuments(state);
    if (maybeSourceDocuments != null) {
      const localStorageSettings =
        getLocalStorageSearchSettings(maybeSourceDocuments);
      dispatch(setSearchTypeSettings(localStorageSettings.searchTypeSettings));
      dispatch(setSourceSettings(localStorageSettings.sourceSettings));
      dispatch(setFilterSettings(localStorageSettings.filterSettings));
    }
  },
});

startAppListening({
  matcher: isAnyOf(setURL, clearURL),
  /**
   * Invalidate previous backend-specific data whenever the backend configuration is updated.
   */
  effect: async (action, { dispatch }) => {
    dispatch(api.util.invalidateTags([QueryTags.BackendSpecific]));
  },
});

startAppListening({
  predicate: (action, currentState, previousState) => {
    return (
      JSON.stringify(currentState.searchSettings) !==
      JSON.stringify(previousState.searchSettings)
    );
  },
  /**
   * Recalculate search results whenever search settings change.
   */
  effect: async (action, { getState, dispatch, getOriginalState }) => {
    const state = getState();
    const originalState = getOriginalState();
    const refreshCardbacks =
      state.searchSettings.searchTypeSettings.filterCardbacks ||
      originalState.searchSettings.searchTypeSettings.filterCardbacks;
    await recalculateSearchResults(state, dispatch, refreshCardbacks);
  },
});

startAppListening({
  matcher: isAnyOf(addMembers, setQueries),
  /**
   * Fetch card documents whenever new members are added to the project or search results are cleared.
   */
  effect: async (action, { dispatch, getState }) => {
    const state = getState();
    await fetchCardDocumentsAndReportError(dispatch);
  },
});

startAppListening({
  actionCreator: fetchCardbacks.fulfilled,
  /**
   * Whenever the list of cardbacks changes, this listener will deselect the cardback
   * if it's no longer valid, then select the first cardback in the list if there are
   * any cardbacks if necessary.
   * Note that this means you can end up with no selected cardback.
   */
  effect: async (action, { dispatch, getState }) => {
    const state = getState();
    const currentCardback = selectProjectCardback(state);
    const cardbacks = selectCardbacks(state);

    let newCardback = currentCardback;
    if (newCardback != null && !cardbacks.includes(newCardback)) {
      newCardback = undefined;
    }
    if (newCardback == null && cardbacks.length > 0) {
      newCardback = cardbacks[0];
    }

    if (newCardback != currentCardback) {
      dispatch(setSelectedCardback({ selectedImage: newCardback ?? null }));
    }
  },
});

startAppListening({
  actionCreator: setQueries,
  /**
   * Whenever a slot's query changes, deselect the currently selected image for that slot,
   * and if there are search results, select the first of those results.
   */
  effect: async (action, { dispatch, getState, condition }) => {
    // wait for all search results to load (removing this will cause a race condition)
    await condition((action, currentState): boolean => {
      if (setQueries.match(action)) {
        const { slots }: { slots: Array<[Faces, number]> } = action.payload;
        return slots
          .map(([face, slot]) => {
            const searchQuery = currentState.project.members[slot][face]?.query;
            return searchQuery?.query != null
              ? currentState.searchResults.searchResults[searchQuery.query][
                  searchQuery.cardType
                ] != null
              : true;
          })
          .every((value) => value);
      } else {
        return true;
      }
    });

    const state = getState();

    const { slots }: { slots: Array<[Faces, number]> } = action.payload;
    for (const [_, [face, slot]] of slots.entries()) {
      const searchQuery = state.project.members[slot][face]?.query;
      const searchResultsForQueryOrDefault =
        selectSearchResultsForQueryOrDefault(
          state,
          searchQuery?.query,
          searchQuery?.cardType,
          face
        ) ?? [];
      const newSelectedImage =
        searchQuery?.query != null
          ? searchResultsForQueryOrDefault[0]
          : undefined;
      if (newSelectedImage != null) {
        dispatch(
          setSelectedImages({
            slots: [[face, slot]],
            selectedImage: newSelectedImage,
          })
        );
      }
    }
  },
});

startAppListening({
  matcher: isAnyOf(fetchSearchResults.fulfilled, fetchCardbacks.fulfilled),
  /**
   * Whenever search results change, this listener will inspect each card slot
   * and ensure that their selected images are valid.
   */
  effect: async (action, { dispatch, getState }) => {
    const state = getState();
    const projectCardback = selectProjectCardback(state);
    for (const [slot, slotProjectMember] of state.project.members.entries()) {
      for (const face of [Front, Back]) {
        const projectMember = slotProjectMember[face];
        const searchQuery = projectMember?.query;
        if (projectMember != null && searchQuery != null) {
          const searchResultsForQueryOrDefault =
            selectSearchResultsForQueryOrDefault(
              state,
              searchQuery?.query,
              searchQuery?.cardType,
              face
            );
          if (searchResultsForQueryOrDefault != null) {
            let mutatedSelectedImage = projectMember.selectedImage;

            // If an image is selected and it's not in the search results, deselect the image and let the user know about it
            if (
              mutatedSelectedImage != null &&
              !searchResultsForQueryOrDefault.includes(mutatedSelectedImage)
            ) {
              if (searchResultsForQueryOrDefault.length > 0) {
                dispatch(
                  recordInvalidIdentifier({
                    slot,
                    face,
                    searchQuery,
                    identifier: mutatedSelectedImage,
                  })
                );
              }
              mutatedSelectedImage = undefined;
            }

            // If no image is selected and there are search results, select the first image in search results
            if (
              searchResultsForQueryOrDefault.length > 0 &&
              mutatedSelectedImage == null
            ) {
              if (searchQuery?.query != null) {
                mutatedSelectedImage = searchResultsForQueryOrDefault[0];
              } else if (face === Back && projectCardback != null) {
                mutatedSelectedImage = projectCardback;
              }
            }

            dispatch(
              setSelectedImages({
                slots: [[face, slot]],
                selectedImage: mutatedSelectedImage,
              })
            );
          }
        }
      }
    }
  },
});

startAppListening({
  matcher: isAnyOf(
    setFavoriteRender,
    removeFavoriteRender,
    toggleFavoriteRender,
    clearFavoriteRenders,
    setAllFavoriteRenders
  ),
  /**
   * Save favorites to localStorage whenever they change.
   */
  effect: async (action, { getState }) => {
    const state = getState();
    setLocalStorageFavorites(state.favorites.favoriteRenders);
  },
});

//# endregion
