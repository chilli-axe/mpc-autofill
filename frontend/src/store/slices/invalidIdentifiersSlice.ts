import { createSelector, PayloadAction } from "@reduxjs/toolkit";

import {
  createAppSlice,
  Faces,
  InvalidIdentifiersState,
  SearchQuery,
} from "@/common/types";
import { RootState } from "@/store/store";

//# region slice configuration

const initialState: InvalidIdentifiersState = { invalidIdentifiers: [] };

export const invalidIdentifiersSlice = createAppSlice({
  name: "invalidIdentifiers",
  initialState,
  reducers: {
    recordInvalidIdentifier: (
      state,
      action: PayloadAction<{
        slot: number;
        face: Faces;
        searchQuery: SearchQuery | undefined;
        identifier: string;
      }>
    ) => {
      const { slot, face, searchQuery, identifier } = action.payload;
      state.invalidIdentifiers[slot] = {
        ...(state.invalidIdentifiers[slot] ?? { front: null, back: null }),
        [face]: [searchQuery, identifier],
      };
    },
    clearInvalidIdentifiers: (state) => {
      state.invalidIdentifiers = [];
    },
  },
});

export default invalidIdentifiersSlice.reducer;
export const { recordInvalidIdentifier, clearInvalidIdentifiers } =
  invalidIdentifiersSlice.actions;

//# endregion

//# region selectors

export const selectInvalidIdentifiers = createSelector(
  (state: RootState) => state.invalidIdentifiers.invalidIdentifiers,
  (invalidIdentifiers) => invalidIdentifiers.filter((item) => item != null)
);
export const selectInvalidIdentifiersCount = createSelector(
  (state: RootState) => selectInvalidIdentifiers(state),
  (invalidIdentifiers) => invalidIdentifiers.length
);

//# endregion
