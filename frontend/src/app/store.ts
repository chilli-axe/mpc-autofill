import { combineReducers, configureStore, Store } from "@reduxjs/toolkit";
import type { PreloadedState } from "@reduxjs/toolkit";

import searchResultsReducer from "../features/search/searchResultsSlice";
import cardDocumentsReducer from "../features/search/cardDocumentsSlice";
import cardbacksReducer from "../features/card/cardbackSlice";
import sourceDocumentsReducer from "../features/search/sourceDocumentsSlice";
import searchSettingsReducer from "../features/searchSettings/searchSettingsSlice";
import projectReducer from "../features/project/projectSlice";
import viewSettingsReducer from "../features/viewSettings/viewSettingsSlice";

// Create the root reducer separately so we can extract the RootState type
const rootReducer = combineReducers({
  viewSettings: viewSettingsReducer,
  searchSettings: searchSettingsReducer,
  searchResults: searchResultsReducer,
  cardDocuments: cardDocumentsReducer,
  cardbacks: cardbacksReducer,
  sourceDocuments: sourceDocumentsReducer,
  project: projectReducer,
});

export const setupStore = (preloadedState?: PreloadedState<RootState>) => {
  return configureStore({ reducer: rootReducer, preloadedState });
};

export const store: Store = setupStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
