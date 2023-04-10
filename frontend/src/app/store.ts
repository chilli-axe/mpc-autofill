import { combineReducers, configureStore, Store } from "@reduxjs/toolkit";
import type { PreloadedState } from "@reduxjs/toolkit";

import { apiSlice } from "@/app/api";
import searchResultsReducer from "../features/search/searchResultsSlice";
import cardDocumentsReducer from "../features/search/cardDocumentsSlice";
import cardbacksReducer from "../features/card/cardbackSlice";
import sourceDocumentsReducer from "../features/search/sourceDocumentsSlice";
import searchSettingsReducer from "../features/searchSettings/searchSettingsSlice";
import projectReducer from "../features/project/projectSlice";
import viewSettingsReducer from "../features/viewSettings/viewSettingsSlice";
import backendReducer from "../features/backend/backendSlice";

// Create the root reducer separately so we can extract the RootState type
const rootReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  viewSettings: viewSettingsReducer,
  searchSettings: searchSettingsReducer,
  searchResults: searchResultsReducer,
  cardDocuments: cardDocumentsReducer,
  cardbacks: cardbacksReducer,
  sourceDocuments: sourceDocumentsReducer,
  project: projectReducer,
  backend: backendReducer,
});

export const setupStore = (preloadedState?: PreloadedState<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
  });
};

export const store: Store = setupStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
