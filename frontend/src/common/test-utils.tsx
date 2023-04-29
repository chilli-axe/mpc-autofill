/**
 * This module contains a few utils for testing with Redux and React Testing Library.
 * Retrieved from https://redux.js.org/usage/writing-tests
 */

import type { PreloadedState } from "@reduxjs/toolkit";
import { Store } from "@reduxjs/toolkit";
import { within } from "@testing-library/dom";
import type { RenderOptions } from "@testing-library/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { PropsWithChildren } from "react";
import { Provider } from "react-redux";

import { RootState, setupStore } from "@/app/store";
import { Faces } from "@/common/types";

//# region redux test setup

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

//# endregion

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

//# region UI interactions

export async function openImportTextModal() {
  // open the modal and find the text area
  screen.getByText("Add Cards", { exact: false }).click();
  await waitFor(() => screen.getByText("Text", { exact: false }).click());
  await waitFor(() => expect(screen.getByText("Add Cards — Text")));
  return screen.getByLabelText("import-text");
}

export async function importText(text: string) {
  const textArea = await openImportTextModal();
  fireEvent.change(textArea, { target: { value: text } });
  screen.getByLabelText("import-text-submit").click();
}

async function openGridSelector(
  cardSlotTestId: string,
  gridSelectorTestId: string,
  selectedImage: number,
  totalImages: number
) {
  expect(totalImages).toBeGreaterThan(1);
  await expectCardSlotState(cardSlotTestId, null, selectedImage, totalImages);

  await waitFor(() =>
    within(screen.getByTestId(cardSlotTestId))
      .getByText(`${selectedImage} / ${totalImages}`)
      .click()
  );
  await waitFor(() => expect(screen.getByText("Option 1")));

  return screen.getByTestId(gridSelectorTestId);
}

export async function openCardSlotGridSelector(
  slot: number,
  face: Faces,
  selectedImage: number,
  totalImages: number
) {
  return await openGridSelector(
    `${face}-slot${slot - 1}`,
    `${face}-slot${slot - 1}-grid-selector`,
    selectedImage,
    totalImages
  );
}

//# endregion

//# region misc

export function normaliseString(text: string): string {
  /**
   * Pretty gross, but useful for asserting that generated XMLs are as expected.
   */

  return text.replaceAll(" ", "").replaceAll("\n", "").replaceAll("\r", "");
}

//# endregion
