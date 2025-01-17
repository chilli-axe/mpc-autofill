import { isAction, MiddlewareAPI } from "@reduxjs/toolkit";
import {
  combineReducers,
  configureStore,
  isRejectedWithValue,
  Tuple,
} from "@reduxjs/toolkit";

import { api } from "@/store/api";
import { listenerMiddleware } from "@/store/listenerMiddleware";
import backendReducer, {
  selectBackendConfigured,
} from "@/store/slices/backendSlice";
import cardbacksReducer from "@/store/slices/cardbackSlice";
import cardDocumentsReducer from "@/store/slices/cardDocumentsSlice";
import finishSettingsReducer from "@/store/slices/FinishSettingsSlice";
import invalidIdentifiersReducer from "@/store/slices/invalidIdentifiersSlice";
import modalsReducer from "@/store/slices/modalsSlice";
import projectReducer from "@/store/slices/projectSlice";
import searchResultsReducer from "@/store/slices/searchResultsSlice";
import searchSettingsReducer from "@/store/slices/SearchSettingsSlice";
import sourceDocumentsReducer from "@/store/slices/sourceDocumentsSlice";
import toastsReducer, { setNotification } from "@/store/slices/toastsSlice";
import viewSettingsReducer from "@/store/slices/viewSettingsSlice";

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
