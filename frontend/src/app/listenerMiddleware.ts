/**
 * Retrieved from https://redux-toolkit.js.org/api/createListenerMiddleware
 */

import {
  addListener,
  createListenerMiddleware,
  isAnyOf,
} from "@reduxjs/toolkit";

import { api } from "@/app/api";
import { Back, Front, QueryTags } from "@/common/constants";
import { getLocalStorageSearchSettings } from "@/common/cookies";
import { Faces } from "@/common/types";
import {
  clearURL,
  selectBackendConfigured,
  setURL,
} from "@/features/backend/backendSlice";
import { fetchCardbacks, selectCardbacks } from "@/features/card/cardbackSlice";
import {
  clearInvalidIdentifier,
  recordInvalidIdentifier,
} from "@/features/invalidIdentifiers/invalidIdentifiersSlice";
import {
  addMembers,
  selectProjectCardback,
  setQueries,
  setSelectedCardback,
  setSelectedImages,
} from "@/features/project/projectSlice";
import { fetchCardDocumentsAndReportError } from "@/features/search/cardDocumentsSlice";
import {
  clearSearchResults,
  fetchSearchResults,
  selectSearchResultsForQueryOrDefault,
} from "@/features/search/searchResultsSlice";
import {
  fetchSourceDocuments,
  fetchSourceDocumentsAndReportError,
  selectSourceDocuments,
} from "@/features/search/sourceDocumentsSlice";
import {
  selectSearchSettingsSourcesValid,
  setFilterSettings,
  setSearchTypeSettings,
  setSourceSettings,
} from "@/features/searchSettings/searchSettingsSlice";

import type { AppDispatch, RootState } from "./store";

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
   * Fetch sources whenever the backend configuration is set.
   */
  effect: async (action, { getState, dispatch }) => {
    const state = getState();
    const isBackendConfigured = selectBackendConfigured(state);
    if (isBackendConfigured) {
      await fetchSourceDocumentsAndReportError(dispatch);
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
  effect: async (action, { getState, dispatch }) => {
    const state = getState();
    const isBackendConfigured = selectBackendConfigured(state);
    const searchSettingsSourcesValid = selectSearchSettingsSourcesValid(state);
    if (isBackendConfigured && searchSettingsSourcesValid) {
      dispatch(clearSearchResults());
      await fetchCardDocumentsAndReportError(dispatch);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addMembers, setQueries),
  /**
   * Fetch card documents whenever new members are added to the project or search results are cleared.
   */
  effect: async (action, { dispatch }) => {
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
                  searchQuery.card_type
                ] != null
              : true;
          })
          .every((value) => value);
      } else {
        return true;
      }
    });

    const state = getState();
    const cardbacks = selectCardbacks(state);

    const { slots }: { slots: Array<[Faces, number]> } = action.payload;
    for (const [_, [face, slot]] of slots.entries()) {
      // the user has specifically opted into changing the query here,
      // so previous warnings that missing cards were requested for this slot are no longer valid
      dispatch(clearInvalidIdentifier({ face, slot }));

      const searchQuery = state.project.members[slot][face]?.query;
      const searchResultsForQueryOrDefault =
        selectSearchResultsForQueryOrDefault(
          state,
          searchQuery,
          face,
          cardbacks
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
  actionCreator: fetchSearchResults.fulfilled,
  /**
   * Whenever search results change, this listener will inspect each card slot
   * and ensure that their selected images are valid.
   */
  effect: async (action, { dispatch, getState }) => {
    const state = getState();
    const cardbacks = selectCardbacks(state);
    const projectCardback = selectProjectCardback(state);
    for (const [slot, slotProjectMember] of state.project.members.entries()) {
      for (const face of [Front, Back]) {
        const projectMember = slotProjectMember[face];
        const searchQuery = projectMember?.query;
        if (projectMember != null && searchQuery != null) {
          const searchResultsForQueryOrDefault =
            selectSearchResultsForQueryOrDefault(
              state,
              searchQuery,
              face,
              cardbacks
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

//# endregion
