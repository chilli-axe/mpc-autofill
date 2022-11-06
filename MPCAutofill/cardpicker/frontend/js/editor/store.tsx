import { configureStore } from "@reduxjs/toolkit";
import cardSlotReducer from "./cardSlotSlice";
import searchResultsReducer from "./searchResultsSlice";

export const store = configureStore({
  reducer: {
    cardSlot: cardSlotReducer,
    searchResults: searchResultsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store