import { PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import {
  CardDocument,
  createAppSlice,
  Modals,
  ModalsState,
  Slots,
} from "@/common/types";

//# region slice configuration

const initialState: ModalsState = { card: null, slots: null, shownModal: null };

export const modalsSlice = createAppSlice({
  name: "modals",
  initialState,
  reducers: {
    showModal: (state, action: PayloadAction<Modals>) => {
      state.shownModal = action.payload;
    },
    setSelectedCardAndShowModal: (
      state,
      action: PayloadAction<[CardDocument, Modals]>
    ) => {
      state.card = action.payload[0];
      state.shownModal = action.payload[1];
    },
    setSelectedSlotsAndShowModal: (
      state,
      action: PayloadAction<[Slots, Modals]>
    ) => {
      state.slots = action.payload[0];
      state.shownModal = action.payload[1];
    },
    hideModal: (state) => {
      // we deliberately keep the current modal data on state here in order for the modal to continue being rendered,
      // as this means the modal fades out properly.
      state.shownModal = null;
    },
  },
});

export default modalsSlice.reducer;
export const {
  showModal,
  setSelectedCardAndShowModal,
  setSelectedSlotsAndShowModal,
  hideModal,
} = modalsSlice.actions;

//# endregion

//# region selectors

export const selectModalCard = (state: RootState) => state.modals.card;
export const selectModalSlots = (state: RootState) => state.modals.slots;
export const selectShownModal = (state: RootState) => state.modals.shownModal;

//# endregion
