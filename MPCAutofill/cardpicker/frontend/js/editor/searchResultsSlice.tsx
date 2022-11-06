import { createSlice } from '@reduxjs/toolkit'

// import { AnyAction } from 'redux'
// import { RootState } from './store'
// import { ThunkAction } from 'redux-thunk'

export const searchResultsSlice = createSlice({
  name: 'searchResults',
  initialState: {
    results: {}
  },
  reducers: {

  }
})

// const logAndAdd = (queries: Array<string>) => {
//   return (dispatch, getState) => {
//     const stateBefore = getState()
//     console.log(`Counter before: ${stateBefore.counter}`)
//     // dispatch(incrementByAmount(queries))
//     const stateAfter = getState()
//     console.log(`Counter after: ${stateAfter.counter}`)
//   }
// }


// Action creators are generated for each case reducer function
// export const { increment, decrement, incrementByAmount } = cardSlotSlice.actions

export default searchResultsSlice.reducer