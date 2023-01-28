import { createSlice } from "@reduxjs/toolkit";
import { MinimumDPI, MaximumDPI, MaximumSize } from "../../common/constants";
import { SearchSettingsState } from "../../common/types";

const initialState: SearchSettingsState = {
  fuzzySearch: false,
  cardSources: null,
  // cardbackSources: null,
  minDPI: MinimumDPI,
  maxDPI: MaximumDPI,
  maxSize: MaximumSize,
};

export const searchSettingsSlice = createSlice({
  name: "searchSettings",
  initialState,
  reducers: {
    enableFuzzySearch: (state) => {
      state.fuzzySearch = true;
    },
    disableFuzzySearch: (state) => {
      state.fuzzySearch = false;
    },
    toggleFuzzySearch: (state) => {
      state.fuzzySearch = !state.fuzzySearch;
    },
    setFuzzySearch: (state, action) => {
      state.fuzzySearch = action.payload;
    },
    addCardSource: (state, action) => {
      state.cardSources.push(action.payload);
    },
    removeCardSource: (state, action) => {
      const index = state.cardSources.indexOf(action.payload);
      if (index !== -1) {
        state.cardSources.splice(index, 1);
      }
    },
    setCardSources: (state, action) => {
      state.cardSources = [...action.payload];
    },
    // addCardbackSource: (state, action) => {
    //   state.cardbackSources.push(action.payload);
    // },
    // removeCardbackSource: (state, action) => {
    //   const index = state.cardbackSources.indexOf(action.payload);
    //   if (index !== -1) {
    //     state.cardbackSources.splice(index, 1);
    //   }
    // },
    setMinDPI: (state, action) => {
      state.minDPI = action.payload;
    },
    setMaxDPI: (state, action) => {
      state.maxDPI = action.payload;
    },
    setMaxSize: (state, action) => {
      state.maxSize = action.payload;
    },
  },
});
export const {
  toggleFuzzySearch,
  enableFuzzySearch,
  disableFuzzySearch,
  setFuzzySearch,
  addCardSource,
  removeCardSource,
  setCardSources,
  // addCardbackSource,
  // removeCardbackSource,
  setMinDPI,
  setMaxDPI,
  setMaxSize,
} = searchSettingsSlice.actions;
export default searchSettingsSlice.reducer;
