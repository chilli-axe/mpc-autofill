import { PayloadAction } from "@reduxjs/toolkit";

import {
  CardDetailedViewModalState,
  ChangeQueryModalState,
  createAppSlice,
  ModalsState,
  NoPropModals,
} from "@/common/types";
import { RootState } from "@/store/store";

//# region slice configuration

const initialState: ModalsState = { props: null, shownModal: null };

export const modalsSlice = createAppSlice({
  name: "modals",
  initialState,
  reducers: {
    showModal: (state, action: PayloadAction<NoPropModals>) => {
      state.shownModal = action.payload;
    },
    showCardDetailedViewModal: (
      state,
      action: PayloadAction<CardDetailedViewModalState>
    ) => {
      state.shownModal = "cardDetailedView";
      state.props = { cardDetailedView: action.payload };
    },
    showChangeQueryModal: (
      state,
      action: PayloadAction<ChangeQueryModalState>
    ) => {
      state.shownModal = "changeQuery";
      state.props = { changeQuery: action.payload };
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
  showCardDetailedViewModal,
  showChangeQueryModal,
  hideModal,
} = modalsSlice.actions;

//# endregion

//# region selectors

export const selectModalProps = (state: RootState) => state.modals.props;
export const selectShownModal = (state: RootState) => state.modals.shownModal;

//# endregion
