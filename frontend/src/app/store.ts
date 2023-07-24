import type { PreloadedState } from "@reduxjs/toolkit";
import type { Middleware, MiddlewareAPI } from "@reduxjs/toolkit";
import { combineReducers, configureStore, isAnyOf } from "@reduxjs/toolkit";
import { isRejectedWithValue } from "@reduxjs/toolkit";

import { api } from "@/app/api";
import {
  listenerMiddleware,
  startAppListening,
} from "@/app/listenerMiddleware";
import backendReducer, {
  selectBackendConfigured,
} from "@/features/backend/backendSlice";
import cardbacksReducer from "@/features/card/cardbackSlice";
import finishSettingsReducer from "@/features/finishSettings/finishSettingsSlice";
import projectReducer, {
  addMembers,
  bulkSetQuery,
  setQuery,
} from "@/features/project/projectSlice";
import cardDocumentsReducer, {
  fetchCardDocumentsAndReportError,
} from "@/features/search/cardDocumentsSlice";
import searchResultsReducer, {
  clearSearchResults,
} from "@/features/search/searchResultsSlice";
import sourceDocumentsReducer from "@/features/search/sourceDocumentsSlice";
import searchSettingsReducer, {
  selectSearchSettingsSourcesValid,
  setFilterSettings,
  setSearchTypeSettings,
  setSourceSettings,
} from "@/features/searchSettings/searchSettingsSlice";
import toastsReducer, { setError } from "@/features/toasts/toastsSlice";
import modalReducer from "@/features/ui/modalSlice";
import viewSettingsReducer from "@/features/viewSettings/viewSettingsSlice";

const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  viewSettings: viewSettingsReducer,
  finishSettings: finishSettingsReducer,
  searchSettings: searchSettingsReducer,
  searchResults: searchResultsReducer,
  cardDocuments: cardDocumentsReducer,
  cardbacks: cardbacksReducer,
  sourceDocuments: sourceDocumentsReducer,
  project: projectReducer,
  backend: backendReducer,
  toasts: toastsReducer,
  modal: modalReducer,
});

//# region middleware

const rtkQueryErrorLogger: Middleware =
  (api: MiddlewareAPI) => (next) => (action) => {
    /**
     * Whenever a RTK Query API request fails, display the response's error message to the user as a toast.
     */

    const backendConfigured = selectBackendConfigured(api.getState());
    if (
      backendConfigured &&
      isRejectedWithValue(action) &&
      action.payload?.data != null
    ) {
      // dispatch the error to the store for displaying in a toast to the user
      api.dispatch(
        setError([
          action.type,
          {
            name: action.payload.data.name,
            message: action.payload.data.message,
          },
        ])
      );
    }

    return next(action);
  };

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

export const setupStore = (preloadedState?: PreloadedState<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .prepend(listenerMiddleware.middleware)
        .concat([api.middleware, rtkQueryErrorLogger]),
  });
};

const store = setupStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export default store;
