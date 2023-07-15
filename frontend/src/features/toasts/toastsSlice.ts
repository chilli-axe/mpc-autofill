import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { APIError } from "@/common/types";
import { ToastsState } from "@/common/types";

const initialState: ToastsState = { errors: {} };

export const toastsSlice = createSlice({
  name: "toasts",
  initialState,
  reducers: {
    setError: (state, action: PayloadAction<[string, APIError]>) => {
      state.errors[action.payload[0]] = action.payload[1];
    },
    clearError: (state, action: PayloadAction<string>) => {
      delete state.errors[action.payload];
    },
  },
});
export const { setError, clearError } = toastsSlice.actions;
export default toastsSlice.reducer;
export const selectToastsErrors = (state: RootState) => state.toasts.errors;
