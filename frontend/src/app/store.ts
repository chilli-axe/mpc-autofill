import type { PreloadedState } from "@reduxjs/toolkit";
import { combineReducers, configureStore, Store } from "@reduxjs/toolkit";

import { apiSlice } from "@/app/api";
import backendReducer from "@/features/backend/backendSlice";
import cardbacksReducer from "@/features/card/cardbackSlice";
import finishSettingsReducer from "@/features/finishSettings/finishSettingsSlice";
import projectReducer from "@/features/project/projectSlice";
import cardDocumentsReducer from "@/features/search/cardDocumentsSlice";
import searchResultsReducer from "@/features/search/searchResultsSlice";
import sourceDocumentsReducer from "@/features/search/sourceDocumentsSlice";
import searchSettingsReducer from "@/features/searchSettings/searchSettingsSlice";
import viewSettingsReducer from "@/features/viewSettings/viewSettingsSlice";

// Create the root reducer separately so we can extract the RootState type
const rootReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  viewSettings: viewSettingsReducer,
  finishSettings: finishSettingsReducer,
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
