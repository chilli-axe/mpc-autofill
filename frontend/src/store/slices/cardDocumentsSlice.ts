/**
 * State management for cards retrieved from the backend.
 */

import { createSelector } from "@reduxjs/toolkit";

import { CardEndpointPageSize } from "@/common/constants";
import {
  CardDocument,
  CardDocumentsState,
  createAppAsyncThunk,
  createAppSlice,
  useAppSelector,
} from "@/common/types";
import { CardDocuments } from "@/common/types";
import { APIGetCards } from "@/store/api";
import { fetchCardbacksAndReportError } from "@/store/slices/cardbackSlice";
import {
  selectProjectMemberIdentifiers,
  selectUniqueCardIdentifiers,
} from "@/store/slices/projectSlice";
import { fetchSearchResultsAndReportError } from "@/store/slices/searchResultsSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

//# region async thunk

const typePrefix = "cardDocuments/fetchCardDocuments";

const fetchCardDocuments = createAppAsyncThunk(
  typePrefix,
  /**
   * This function queries card documents (entire database rows) from the backend. It only queries cards which have
   * not yet been queried.
   */
  async (arg, { dispatch, getState }) => {
    await fetchSearchResultsAndReportError(dispatch);
    await fetchCardbacksAndReportError(dispatch);

    const state = getState() as RootState;

    const allIdentifiers = selectUniqueCardIdentifiers(state);
    const identifiersWithKnownData = new Set(
      Object.keys(state.cardDocuments.cardDocuments)
    );
    const identifiersToSearch = Array.from(
      new Set(
        Array.from(allIdentifiers).filter(
          (item) => !identifiersWithKnownData.has(item)
        )
      )
    );

    const backendURL = state.backend.url;
    if (identifiersToSearch.length > 0 && backendURL != null) {
      // this block of code looks a bit arcane.
      // we're dynamically constructing a promise chain according to the number of requests we need to make
      // to retrieve all database rows corresponding to `identifiersToSearch`.
      // e.g. say that `identifiersToSearch` contains 1500 identifiers.
      // two requests will be issued, the first for 1000 cards, and the second for 500 cards
      // (with the second request only commencing once the first has finished).
      return Array.from(
        Array(
          Math.ceil(identifiersToSearch.length / CardEndpointPageSize)
        ).keys()
      ).reduce(function (promiseChain: Promise<CardDocuments>, page: number) {
        return promiseChain.then(async function (previousValue: CardDocuments) {
          const cards = await APIGetCards(
            backendURL,
            identifiersToSearch.slice(
              page * CardEndpointPageSize,
              (page + 1) * CardEndpointPageSize
            )
          );
          return { ...previousValue, ...cards };
        });
      }, Promise.resolve({}));
    }
  }
);

export async function fetchCardDocumentsAndReportError(dispatch: AppDispatch) {
  try {
    await dispatch(fetchCardDocuments()).unwrap();
  } catch (error: any) {
    dispatch(
      setNotification([
        typePrefix,
        { name: error.name, message: error.message, level: "error" },
      ])
    );
    return null;
  }
}

//# endregion

//# region slice configuration

const initialState: CardDocumentsState = {
  cardDocuments: {},
  status: "idle",
  error: null,
};

export const cardDocumentsSlice = createAppSlice({
  name: "cardDocuments",
  initialState,
  reducers: {
    addCardDocuments: (state, action) => {
      state.cardDocuments = { ...state.cardDocuments, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCardDocuments.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(fetchCardDocuments.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.cardDocuments = { ...state.cardDocuments, ...action.payload };
      })
      .addCase(fetchCardDocuments.rejected, (state, action) => {
        state.status = "failed";
        state.error = {
          name: action.error.name ?? null,
          message: action.error.message ?? null,
          level: "error",
        };
      });
  },
});

export default cardDocumentsSlice.reducer;

//# endregion

//# region selectors

export const selectCardDocumentByIdentifier = (
  state: RootState,
  imageIdentifier: string | undefined
): CardDocument | undefined =>
  imageIdentifier != null
    ? state.cardDocuments.cardDocuments[imageIdentifier]
    : undefined;

export const selectCardDocumentsByIdentifier = createSelector(
  (state: RootState, identifiers: Array<string>) => identifiers,
  (state: RootState, identifiers: Array<string>) =>
    state.cardDocuments.cardDocuments,
  (identifiers, cardDocuments) =>
    Object.fromEntries(
      identifiers.map((identifier) => [identifier, cardDocuments[identifier]])
    )
);

export const selectCardSizesByIdentifier = createSelector(
  (state: RootState, identifiers: Array<string>) => identifiers,
  (state: RootState, identifiers: Array<string>) =>
    state.cardDocuments.cardDocuments,
  (identifiers, cardDocuments) =>
    Object.fromEntries(
      identifiers.map((identifier) => [
        identifier,
        cardDocuments[identifier]?.size ?? 0,
      ])
    )
);

//# endregion

//# region hooks

export function useCardDocumentsByIdentifier(): {
  [identifier: string]: CardDocument;
} {
  const identifiers = Array.from(
    useAppSelector(selectProjectMemberIdentifiers)
  );
  return useAppSelector((state) =>
    selectCardDocumentsByIdentifier(state, identifiers)
  );
}

//# endregion
