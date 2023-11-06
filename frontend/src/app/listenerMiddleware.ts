/**
 * Retrieved from https://redux-toolkit.js.org/api/createListenerMiddleware
 */

import type { TypedAddListener, TypedStartListening } from "@reduxjs/toolkit";
import {
  addListener,
  createListenerMiddleware,
  isAnyOf,
} from "@reduxjs/toolkit";
import { useEffect } from "react";

import {
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
import { fetchSourceDocumentsAndReportError } from "@/features/search/sourceDocumentsSlice";
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
  matcher: isAnyOf(setURL),
  effect: async (action, { getState, dispatch }) => {
    /**
     * Fetch sources whenever the backend configuration changes.
     */

    const state = getState();
    const isBackendConfigured = selectBackendConfigured(state);
    if (isBackendConfigured) {
      await fetchSourceDocumentsAndReportError(dispatch);
    }
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
