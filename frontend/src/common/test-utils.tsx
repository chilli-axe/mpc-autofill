/**
 * This module contains a few utils for testing with Redux and React Testing Library.
 * Retrieved from https://redux.js.org/usage/writing-tests
 */

import React, { PropsWithChildren } from "react";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import type { PreloadedState } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

import { RootState, setupStore } from "@/app/store";
import { Store } from "@reduxjs/toolkit";

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
