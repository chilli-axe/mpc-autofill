import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { CardDocument, Modals, ModalState } from "@/common/types";

const initialState: ModalState = { card: null, shownModal: null };

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
    hideModal: (state) => {
      // we deliberately keep the current image on state here in order for the modal to continue being rendered,
      // as this means the modal fades out properly.
      state.shownModal = null;
    },
  },
});
export const { setSelectedCardAndShowModal, hideModal } = modalSlice.actions;
export default modalSlice.reducer;
