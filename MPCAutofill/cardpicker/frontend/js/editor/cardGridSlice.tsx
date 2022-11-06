import { createSlice } from '@reduxjs/toolkit'

export const cardGridSlice = createSlice({
  name: 'cardGrid',
  initialState: {
    activeFace: "front",
  },
  reducers: {
    switchToFront: state => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      // TODO: make these wrap around
      state.activeFace = "front"
    },
    switchToBack: state => {
      state.activeFace = "back"
    },

  }
})

// Action creators are generated for each case reducer function
export const { switchToFront, switchToBack } = cardGridSlice.actions

export default cardGridSlice.reducer