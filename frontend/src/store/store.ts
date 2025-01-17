import { isAction, MiddlewareAPI } from "@reduxjs/toolkit";
import {
  combineReducers,
  configureStore,
  isRejectedWithValue,
  Tuple,
} from "@reduxjs/toolkit";

import backendReducer, {
  selectBackendConfigured,
} from "@/features/backend/backendSlice";
import cardbacksReducer from "@/features/card/cardbackSlice";
import finishSettingsReducer from "@/features/finishSettings/FinishSettingsSlice";
import invalidIdentifiersReducer from "@/features/invalidIdentifiers/invalidIdentifiersSlice";
import modalsReducer from "@/features/modals/modalsSlice";
import projectReducer from "@/features/project/projectSlice";
import cardDocumentsReducer from "@/features/search/cardDocumentsSlice";
import searchResultsReducer from "@/features/search/searchResultsSlice";
import sourceDocumentsReducer from "@/features/search/sourceDocumentsSlice";
import searchSettingsReducer from "@/features/searchSettings/SearchSettingsSlice";
import toastsReducer, { setNotification } from "@/features/toasts/toastsSlice";
import viewSettingsReducer from "@/features/viewSettings/viewSettingsSlice";
import { api } from "@/store/api";
import { listenerMiddleware } from "@/store/listenerMiddleware";

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
  modals: modalsReducer,
  invalidIdentifiers: invalidIdentifiersReducer,
});

//# region middleware

/**
 * Whenever a RTK Query API request fails, display the response's error message to the user as a toast.
 */
const rtkQueryErrorLogger =
  (api: MiddlewareAPI) =>
  (next: (action: unknown) => unknown) =>
  (action: unknown) => {
    if (!isAction(action)) {
      return;
    }

    const backendConfigured = selectBackendConfigured(api.getState());
    if (
      backendConfigured &&
      isRejectedWithValue(action) &&
      action.payload != null
    ) {
      // dispatch the error to the store for displaying in a toast to the user
      const data = (
        action.payload as {
          data?: { name?: string | null; message?: string | null };
        }
      )?.data;
      api.dispatch(
        setNotification([
          action.type,
          {
            name: data?.name ?? null,
            message: data?.message ?? null,
            level: "error",
          },
        ])
      );
    }

    return next(action);
  };

//# endregion

export const setupStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .prepend(listenerMiddleware.middleware)
        .concat(new Tuple(api.middleware, rtkQueryErrorLogger)),
  });
};

const store = setupStore();

export type AppStore = ReturnType<typeof setupStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];

export default store;
