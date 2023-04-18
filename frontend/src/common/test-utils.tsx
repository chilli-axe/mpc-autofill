/**
 * This module contains a few utils for testing with Redux and React Testing Library.
 * Retrieved from https://redux.js.org/usage/writing-tests
 */

import React, { PropsWithChildren } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { within } from "@testing-library/dom";
import type { PreloadedState } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

import { RootState, setupStore } from "@/app/store";
import { Store } from "@reduxjs/toolkit";
import { Faces } from "@/common/types";

// This type interface extends the default options for render from RTL, as well
// as allows the user to specify other things such as initialState, store.
interface ExtendedRenderOptions extends Omit<RenderOptions, "queries"> {
  preloadedState?: PreloadedState<RootState>;
  store?: Store;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    // Automatically create a store instance if no store was passed in
    store = setupStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: PropsWithChildren<{}>): JSX.Element {
    if (store != undefined) {
      return <Provider store={store}>{children}</Provider>;
    } else {
      return <>{children}</>;
    }
  }

  // Return an object with the store and all of RTL's query functions
  // @ts-ignore
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

//# region assertions

export async function expectCardSlotToExist(slot: number) {
  // front and back are both picked up by this query
  await waitFor(() =>
    expect(screen.getAllByText(`Slot ${slot}`)).toHaveLength(2)
  );
}

export async function expectCardSlotToNotExist(slot: number) {
  await waitFor(() =>
    expect(screen.queryAllByText(`Slot ${slot}`)).toHaveLength(0)
  );
}

async function expectCardSlotState(
  testId: string,
  cardName: string | null,
  selectedImage: number | null,
  totalImages: number | null
) {
  /**
   * This function helps with asserting that a particular card slot exists
   * and has the expected image selected.
   */

  await waitFor(() => expect(screen.getByTestId(testId)).toBeInTheDocument());
  const cardElement = screen.getByTestId(testId);
  if (cardName != null) {
    await waitFor(() =>
      expect(within(cardElement).getByText(cardName)).toBeInTheDocument()
    );
  }
  if (selectedImage != null && totalImages != null) {
    await waitFor(() =>
      expect(
        within(cardElement).getByText(`${selectedImage} / ${totalImages}`)
      ).toBeInTheDocument()
    );
  }
}

export async function expectCardGridSlotState(
  slot: number,
  face: Faces,
  cardName: string | null,
  selectedImage: number | null,
  totalImages: number | null
) {
  // note: the specified `slot` should be 1-indexed
  return await expectCardSlotState(
    `${face}-slot${slot - 1}`,
    cardName,
    selectedImage,
    totalImages
  );
}

export async function expectCardbackSlotState(
  cardName: string | null,
  selectedImage: number | null,
  totalImages: number | null
) {
  return await expectCardSlotState(
    "common-cardback",
    cardName,
    selectedImage,
    totalImages
  );
}

//# endregion
