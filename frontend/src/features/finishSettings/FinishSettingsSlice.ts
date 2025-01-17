import { PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { CardstockFoilCompatibility } from "@/common/constants";
import { Cardstock, createAppSlice, FinishSettingsState } from "@/common/types";

//# region slice configuration

const initialState: FinishSettingsState = {
  cardstock: "(S30) Standard Smooth",
  foil: false,
};

export const finishSettingsSlice = createAppSlice({
  name: "finishSettings",
  initialState,
  reducers: {
    setCardstock: (state, action: PayloadAction<Cardstock>) => {
      state.cardstock = action.payload;
      if (!CardstockFoilCompatibility[action.payload]) {
        state.foil = false;
      }
    },
    setFoil: (state, action: PayloadAction<boolean>) => {
      state.foil = CardstockFoilCompatibility[state.cardstock]
        ? action.payload
        : false;
    },
    toggleFoil: (state) => {
      state.foil = CardstockFoilCompatibility[state.cardstock]
        ? !state.foil
        : false;
    },
  },
});

export const { setCardstock, setFoil, toggleFoil } =
  finishSettingsSlice.actions;
export default finishSettingsSlice.reducer;

//# endregion

//# region selectors

export const selectFinishSettings = (state: RootState): FinishSettingsState =>
  state.finishSettings;

//# endregion
