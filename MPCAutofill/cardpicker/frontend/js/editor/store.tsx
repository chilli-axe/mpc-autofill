import { configureStore } from "@reduxjs/toolkit";
import cardSlotReducer from "./cardSlotSlice";
import searchResultsReducer from "./searchResultsSlice";
import cardDocumentsReducer from "./cardDocumentsSlice";

export const store = configureStore({
  reducer: {
    cardSlot: cardSlotReducer,
    searchResults: searchResultsReducer,
    cardDocuments: cardDocumentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
