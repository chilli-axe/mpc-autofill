/**
 * Retrieved from https://redux-toolkit.js.org/api/createListenerMiddleware
 */

import type { TypedAddListener, TypedStartListening } from "@reduxjs/toolkit";
import {
  addListener,
  createListenerMiddleware,
  isAnyOf,
} from "@reduxjs/toolkit";

import { api } from "@/app/api";
import { QueryTags } from "@/common/constants";
import { getLocalStorageSearchSettings } from "@/common/cookies";
import {
  clearURL,
  selectBackendConfigured,
  setURL,
} from "@/features/backend/backendSlice";
import {
  addMembers,
  bulkSetQuery,
  setQuery,
} from "@/features/project/projectSlice";
import { fetchCardDocumentsAndReportError } from "@/features/search/cardDocumentsSlice";
import { clearSearchResults } from "@/features/search/searchResultsSlice";
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

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;

const startAppListening =
  listenerMiddleware.startListening as AppStartListening;

const addAppListener = addListener as TypedAddListener<RootState, AppDispatch>;

//# endregion

//# region listeners

startAppListening({
  actionCreator: setURL,
  effect: async (action, { getState, dispatch }) => {
    /**
     * Fetch sources whenever the backend configuration is set.
     */

    const state = getState();
    const isBackendConfigured = selectBackendConfigured(state);
    if (isBackendConfigured) {
      await fetchSourceDocumentsAndReportError(dispatch);
    }
  },
});

startAppListening({
  actionCreator: fetchSourceDocuments.fulfilled,
  effect: async (action, { getState, dispatch }) => {
    /**
     * Populate search settings in the Redux store from search settings
     * whenever the list of sources changes.
     */

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
  effect: async (action, { dispatch }) => {
    /**
     * Invalidate previous backend-specific data whenever the backend configuration is updated.
     */

    dispatch(api.util.invalidateTags([QueryTags.BackendSpecific]));
  },
});

startAppListening({
  matcher: isAnyOf(setSearchTypeSettings, setSourceSettings, setFilterSettings),
  effect: async (action, { getState, dispatch }) => {
    /**
     * Recalculate search results whenever search settings change.
     */

    const state = getState();
    const isBackendConfigured = selectBackendConfigured(state);
    const searchSettingsSourcesValid = selectSearchSettingsSourcesValid(state);
    if (isBackendConfigured && searchSettingsSourcesValid) {
      await dispatch(clearSearchResults());
      await fetchCardDocumentsAndReportError(dispatch);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addMembers, setQuery, bulkSetQuery),
  effect: async (action, { dispatch }) => {
    /**
     * Fetch card documents whenever new members are added to the project or search results are cleared.
     */

    await fetchCardDocumentsAndReportError(dispatch);
  },
});

//# endregion
