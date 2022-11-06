import { createSlice } from '@reduxjs/toolkit'

export const cardSlotSlice = createSlice({
  name: 'cardSlot',
  initialState: {
    face: "front",
    selectedImage: null,
  },
  reducers: {
    changeImage: (state, action) => {
      state.selectedImage = action.payload
    }
  }
})

// Action creators are generated for each case reducer function
export const { changeImage } = cardSlotSlice.actions

export default cardSlotSlice.reducer