import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { CardDocument, Modals, ModalState, Slots } from "@/common/types";

//# region slice configuration

const initialState: ModalState = { card: null, slots: null, shownModal: null };

export const modalSlice = createSlice({
  name: "modal",
  initialState,
  reducers: {
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

export default modalSlice.reducer;
export const {
  setSelectedCardAndShowModal,
  setSelectedSlotsAndShowModal,
  hideModal,
} = modalSlice.actions;

//# endregion

//# region selectors

export const selectModalCard = (state: RootState) => state.modal.card;
export const selectModalSlots = (state: RootState) => state.modal.slots;
export const selectShownModal = (state: RootState) => state.modal.shownModal;

//# endregion
