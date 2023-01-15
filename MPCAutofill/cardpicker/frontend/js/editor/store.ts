import { configureStore } from "@reduxjs/toolkit";
import searchResultsReducer from "./searchResultsSlice";
import cardDocumentsReducer from "./cardDocumentsSlice";
import cardbacksReducer from "./cardbackSlice";
import sourceDocumentsReducer from "./sourceDocumentsSlice";
import searchSettingsReducer from "./searchSettingsSlice";
import projectReducer from "./projectSlice";
import viewSettingsReducer from "./viewSettingsSlice";

export const store = configureStore({
  reducer: {
    viewSettings: viewSettingsReducer,
    searchSettings: searchSettingsReducer,
    searchResults: searchResultsReducer,
    cardDocuments: cardDocumentsReducer,
    cardbacks: cardbacksReducer,
    sourceDocuments: sourceDocumentsReducer,
    project: projectReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
