import { configureStore } from "@reduxjs/toolkit";
import cardSlotReducer from "./cardSlotSlice";
import searchResultsReducer from "./searchResultsSlice";
import cardDocumentsReducer from "./cardDocumentsSlice";
import sourceDocumentsReducer from "./sourceDocumentsSlice";
import searchSettingsReducer from "./searchSettingsSlice";
import projectReducer from "./projectSlice";

export const store = configureStore({
  reducer: {
    cardSlot: cardSlotReducer,
    searchSettings: searchSettingsReducer,
    searchResults: searchResultsReducer,
    cardDocuments: cardDocumentsReducer,
    sourceDocuments: sourceDocumentsReducer,
    project: projectReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
