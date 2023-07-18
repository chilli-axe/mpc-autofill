import type { PreloadedState } from "@reduxjs/toolkit";
import type { Middleware, MiddlewareAPI } from "@reduxjs/toolkit";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { isRejectedWithValue } from "@reduxjs/toolkit";

import { api } from "@/app/api";
import backendReducer from "@/features/backend/backendSlice";
import cardbacksReducer from "@/features/card/cardbackSlice";
import finishSettingsReducer from "@/features/finishSettings/finishSettingsSlice";
import projectReducer from "@/features/project/projectSlice";
import cardDocumentsReducer from "@/features/search/cardDocumentsSlice";
import searchResultsReducer from "@/features/search/searchResultsSlice";
import sourceDocumentsReducer from "@/features/search/sourceDocumentsSlice";
import searchSettingsReducer from "@/features/searchSettings/searchSettingsSlice";
import toastsReducer, { setError } from "@/features/toasts/toastsSlice";
import modalReducer from "@/features/ui/modalSlice";
import viewSettingsReducer from "@/features/viewSettings/viewSettingsSlice";

// Create the root reducer separately so we can extract the RootState type
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

const rtkQueryErrorLogger: Middleware =
  (api: MiddlewareAPI) => (next) => (action) => {
    const backendURL = api.getState().backend.url;
    if (
      backendURL != null &&
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

export const setupStore = (preloadedState?: PreloadedState<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat([api.middleware, rtkQueryErrorLogger]),
  });
};

const store = setupStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch; // AppStore['dispatch']

export default store;
