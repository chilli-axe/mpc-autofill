import { createSelector, PayloadAction } from "@reduxjs/toolkit";

import { createAppSlice } from "@/common/types";
import { RootState } from "@/store/store";

//# region slice configuration

/**
 * Maps card search queries to favorite render identifiers.
 * Key: searchq (card name/query)
 * Value: array of identifiers (the favorite renders' identifiers)
 */
export interface FavoritesState {
  favoriteRenders: { [searchq: string]: string[] };
}

const initialState: FavoritesState = {
  favoriteRenders: {},
};

export const favoritesSlice = createAppSlice({
  name: "favorites",
  initialState,
  reducers: {
    /**
     * Add a favorite render for a specific card.
     * @param searchq - The card's search query (card name)
     * @param identifier - The identifier of the favorite render
     */
    setFavoriteRender: (
      state,
      action: PayloadAction<{ searchq: string; identifier: string }>
    ) => {
      const { searchq, identifier } = action.payload;
      if (!state.favoriteRenders[searchq]) {
        state.favoriteRenders[searchq] = [];
      }
      if (!state.favoriteRenders[searchq].includes(identifier)) {
        state.favoriteRenders[searchq].push(identifier);
      }
    },
    /**
     * Remove a favorite render for a specific card.
     * @param searchq - The card's search query (card name)
     * @param identifier - The identifier of the favorite render to remove
     */
    removeFavoriteRender: (
      state,
      action: PayloadAction<{ searchq: string; identifier: string }>
    ) => {
      const { searchq, identifier } = action.payload;
      if (state.favoriteRenders[searchq]) {
        state.favoriteRenders[searchq] = state.favoriteRenders[searchq].filter(
          (id) => id !== identifier
        );
        // Remove the key if the array is now empty
        if (state.favoriteRenders[searchq].length === 0) {
          delete state.favoriteRenders[searchq];
        }
      }
    },
    /**
     * Toggle a favorite render for a specific card.
     * If the card already has this identifier as favorite, it removes it.
     * Otherwise, it adds it to the favorites array.
     * @param searchq - The card's search query (card name)
     * @param identifier - The identifier of the render to toggle
     */
    toggleFavoriteRender: (
      state,
      action: PayloadAction<{ searchq: string; identifier: string }>
    ) => {
      const { searchq, identifier } = action.payload;
      if (!state.favoriteRenders[searchq]) {
        state.favoriteRenders[searchq] = [];
      }
      const index = state.favoriteRenders[searchq].indexOf(identifier);
      if (index > -1) {
        state.favoriteRenders[searchq].splice(index, 1);
        // Remove the key if the array is now empty
        if (state.favoriteRenders[searchq].length === 0) {
          delete state.favoriteRenders[searchq];
        }
      } else {
        state.favoriteRenders[searchq].push(identifier);
      }
    },
    /**
     * Clear all favorite renders.
     */
    clearFavoriteRenders: (state) => {
      state.favoriteRenders = {};
    },
    /**
     * Set all favorite renders at once (e.g., when loading from localStorage).
     * @param favoriteRenders - The complete favorites object to set
     */
    setAllFavoriteRenders: (
      state,
      action: PayloadAction<FavoritesState["favoriteRenders"]>
    ) => {
      state.favoriteRenders = action.payload;
    },
  },
});

export const {
  setFavoriteRender,
  removeFavoriteRender,
  toggleFavoriteRender,
  clearFavoriteRenders,
  setAllFavoriteRenders,
} = favoritesSlice.actions;
export default favoritesSlice.reducer;

//# endregion

//# region selectors

export const selectFavoriteRenders = (
  state: RootState
): FavoritesState["favoriteRenders"] => state.favorites.favoriteRenders;

export const selectIsFavoriteRender = createSelector(
  (state: RootState, searchq: string, identifier: string) => ({
    searchq,
    identifier,
  }),
  (state: RootState) => state.favorites.favoriteRenders,
  ({ searchq, identifier }, favoriteRenders) =>
    (favoriteRenders[searchq] ?? []).includes(identifier)
);

/**
 * Returns a Set of all favorite render identifiers for fast O(1) lookup.
 * Useful when you have identifiers but not searchq values.
 */
export const selectFavoriteIdentifiersSet = createSelector(
  (state: RootState) => state.favorites.favoriteRenders,
  (favoriteRenders) => new Set(Object.values(favoriteRenders).flat())
);

//# endregion
