import { PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { createAppSlice, Notification } from "@/common/types";
import { ToastsState } from "@/common/types";

//# region slice configuration

const initialState: ToastsState = { notifications: {} };

export const toastsSlice = createAppSlice({
  name: "toasts",
  initialState,
  reducers: {
    setNotification: (state, action: PayloadAction<[string, Notification]>) => {
      state.notifications[action.payload[0]] = action.payload[1];
    },
    clearNotification: (state, action: PayloadAction<string>) => {
      delete state.notifications[action.payload];
    },
  },
});

export const { setNotification, clearNotification } = toastsSlice.actions;
export default toastsSlice.reducer;

//# endregion

//# region selectors

export const selectToastsNotifications = (state: RootState) =>
  state.toasts.notifications;

//# endregion
