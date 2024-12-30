/**
 * This module contains a few utils for testing with Redux and React Testing Library.
 * Retrieved from https://redux.js.org/usage/writing-tests
 */

import { Store } from "@reduxjs/toolkit";
import { within } from "@testing-library/dom";
import type { RenderOptions } from "@testing-library/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileSaver from "file-saver";
import { MemoryRouterProvider } from "next-router-mock/MemoryRouterProvider";
import React, { PropsWithChildren } from "react";
import { Provider } from "react-redux";

import { RootState, setupStore } from "@/app/store";
import { localBackendURL } from "@/common/test-constants";
import { Faces } from "@/common/types";
import { setURL } from "@/features/backend/backendSlice";
import { LayoutWithoutReduxProvider } from "@/features/ui/layout";

//# region redux test setup

// This type interface extends the default options for render from RTL, as well
// as allows the user to specify other things such as initialState, store.
interface ExtendedRenderOptions extends Omit<RenderOptions, "queries"> {
  preloadedState?: Partial<RootState>;
  store?: Store;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    // Automatically create a store instance if no store was passed in
    store = setupStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {},
  configureLocalBackend: boolean = true
) {
  function Wrapper({ children }: PropsWithChildren<{}>): JSX.Element {
    if (store != undefined) {
      if (configureLocalBackend) {
        store.dispatch(setURL(localBackendURL));
      }
      return (
        <MemoryRouterProvider>
          <Provider store={store}>
            <LayoutWithoutReduxProvider>{children}</LayoutWithoutReduxProvider>
          </Provider>
        </MemoryRouterProvider>
      );
    } else {
      return (
        <MemoryRouterProvider>
          <LayoutWithoutReduxProvider>{children}</LayoutWithoutReduxProvider>
        </MemoryRouterProvider>
      );
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

/**
 * This function helps with asserting that a particular card slot exists
 * and has the expected image selected.
 */
async function expectCardSlotState(
  testId: string,
  cardName?: string | null,
  selectedImage?: number | null,
  totalImages?: number | null
) {
  await waitFor(() => expect(screen.getByTestId(testId)).toBeInTheDocument());
  const cardElement = screen.getByTestId(testId);
  if (cardName === null) {
    await waitFor(() =>
      expect(
        within(cardElement).getByText("Your search query")
      ).toBeInTheDocument()
    );
  } else if (cardName !== undefined) {
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
  cardName?: string | null,
  selectedImage?: number | null,
  totalImages?: number | null,
  slotSelected?: boolean | null
) {
  const testId = `${face}-slot${slot - 1}`;
  // note: the specified `slot` should be 1-indexed
  await expectCardSlotState(testId, cardName, selectedImage, totalImages);
  if (slotSelected != null) {
    const cardElement = screen.getByTestId(testId);
    const labelText = `${face}${slot - 1}-${slotSelected ? "" : "un"}checked`;
    await waitFor(() =>
      expect(within(cardElement).getByLabelText(labelText)).toBeInTheDocument()
    );
  }
}

export async function expectCardbackSlotState(
  cardName?: string,
  selectedImage?: number,
  totalImages?: number
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

/**
 * Note: the `ping` function from Ping.js must be mocked in tests where you call this function.
 * We cannot use MSW to intercept Ping.js because that library works by creating an `Image` with
 * `src` of the site to ping's `favicon.ico`, and MSW can't intercept requests to load images.
 */
export async function configureBackend(url: string) {
  await waitFor(() => screen.getByLabelText("configure-server-btn").click());

  const backendOffcanvas = await waitFor(() =>
    screen.getByTestId("backend-offcanvas")
  );

  const textField = await waitFor(() =>
    within(backendOffcanvas).getByLabelText("backend-url")
  );
  const user = userEvent.setup();
  await user.clear(textField);
  if (url !== "") {
    await user.type(textField, url);
  }
  within(backendOffcanvas).getByLabelText("submit-backend-url").click();
  await waitFor(() =>
    expect(
      within(backendOffcanvas).getByText("You're currently connected to", {
        exact: false,
      })
    ).toBeInTheDocument()
  );
  within(backendOffcanvas).getByLabelText("Close").click();
}

export async function configureDefaultBackend() {
  return await configureBackend(localBackendURL);
}

export async function getErrorToast(): Promise<HTMLElement> {
  const errorToast = await waitFor(
    () => screen.getByText("An Error Occurred").parentElement?.parentElement
  );
  if (errorToast == null) {
    throw new Error("error toast is not present");
  }
  return errorToast;
}

export function getAddCardsMenu() {
  return within(screen.getByTestId("right-panel")).getByText("Add Cards", {
    exact: false,
  });
}

export async function openImportTextModal() {
  // open the modal and find the text area
  const addCardsMenu = getAddCardsMenu();
  addCardsMenu.click();
  await waitFor(() => screen.getByText("Text", { exact: false }).click());
  await waitFor(() => expect(screen.getByText("Add Cards — Text")));
  await waitFor(() =>
    expect(screen.getByLabelText("import-text-submit")).not.toBeDisabled()
  ); // here, we wait for DFC pairs to be loaded
  return screen.getByLabelText("import-text");
}

export async function importText(text: string) {
  const textArea = await openImportTextModal();
  const user = userEvent.setup();
  await user.clear(textArea);
  if (text !== "") {
    await user.type(textArea, text);
  }
  screen.getByLabelText("import-text-submit").click();
}

export async function openImportCSVModal() {
  // open the modal and find the upload dropzone
  const addCardsMenu = getAddCardsMenu();
  addCardsMenu.click();
  await waitFor(() => screen.getByText("CSV", { exact: false }).click());
  await waitFor(() => expect(screen.getByText("Add Cards — CSV")));
  const dropzone = screen.getByLabelText("import-csv");
  await waitFor(() => expect(dropzone).not.toBeDisabled()); // here, we wait for DFC pairs to be loaded
  return dropzone.querySelector("input")!;
}

export async function importCSV(fileContents: string) {
  const user = userEvent.setup();
  const dropzone = await openImportCSVModal();
  const file = new File([fileContents], "test.csv", { type: "text/csv" });
  await user.upload(dropzone, [file]);
}

export async function openImportXMLModal() {
  // open the modal and find the upload dropzone
  const addCardsMenu = getAddCardsMenu();
  addCardsMenu.click();
  await waitFor(() => screen.getByText("XML", { exact: false }).click());
  await waitFor(() => expect(screen.getByText("Add Cards — XML")));
  const dropzone = screen.getByLabelText("import-xml");
  await waitFor(() => expect(dropzone).not.toBeDisabled()); // here, we wait for DFC pairs to be loaded
  return dropzone.querySelector("input")!;
}

export async function importXML(
  fileContents: string,
  useXMLCardback: boolean = false
) {
  const user = userEvent.setup();
  const dropzone = await openImportXMLModal();

  const file = new File([fileContents], "test.xml", {
    type: "text/xml;charset=utf-8",
  });
  if (useXMLCardback) {
    await waitFor(() => screen.getByText("Retain Selected Cardback").click());
  }

  await user.upload(dropzone, [file]);
}

export async function openImportURLModal() {
  // open the modal and find the text input
  const addCardsMenu = getAddCardsMenu();
  addCardsMenu.click();
  await waitFor(() => screen.getByText("URL", { exact: false }).click());
  await waitFor(() => expect(screen.getByText("Add Cards — URL")));
  return screen.getByLabelText("import-url");
}

async function openGridSelector(
  cardSlotTestId: string,
  gridSelectorTestId: string,
  selectedImage: number,
  totalImages: number
) {
  expect(totalImages).toBeGreaterThan(1);
  await expectCardSlotState(
    cardSlotTestId,
    undefined,
    selectedImage,
    totalImages
  );

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

export async function selectSlot(
  slot: number,
  face: Faces,
  clickType: "double" | "shift" | null = null
) {
  const cardElement = screen.getByTestId(`${face}-slot${slot - 1}`);
  const user = userEvent.setup();
  const element = within(cardElement).getByLabelText(
    `select-${face}${slot - 1}`
  )!.children[0];
  if (clickType === "double") {
    fireEvent.click(element, { detail: 2 });
  } else if (clickType === "shift") {
    await user.keyboard("{Shift>}");
    await user.click(element);
    await user.keyboard("{/Shift}");
  } else {
    await user.click(element);
  }
  await waitFor(() =>
    expect(
      within(cardElement).getByLabelText(`select-${face}${slot - 1}`)!
        .children[0]
    ).toHaveClass("bi-check-square")
  );
}

export async function deselectSlot(slot: number, face: Faces) {
  const cardElement = screen.getByTestId(`${face}-slot${slot - 1}`);
  const user = userEvent.setup();
  await user.click(
    within(cardElement).getByLabelText(`select-${face}${slot - 1}`)!.children[0]
  );
  await waitFor(() =>
    expect(
      within(cardElement).getByLabelText(`select-${face}${slot - 1}`)!
        .children[0]
    ).toHaveClass("bi-square")
  );
}

export function clickMoreSelectOptionsDropdown() {
  screen.getByTestId("more-select-options").click();
}

export async function selectSimilar() {
  clickMoreSelectOptionsDropdown();
  await waitFor(() => screen.getByText("Select Similar").click());
}

export async function selectAll() {
  clickMoreSelectOptionsDropdown();
  await waitFor(() => screen.getByText("Select All").click());
}

export async function changeQueries(query: string) {
  const textField = await waitFor(() =>
    screen.getByLabelText("change-selected-image-queries-text")
  );
  const user = userEvent.setup();
  await user.clear(textField);
  if (query !== "") {
    await user.type(textField, query);
  }
  screen.getByLabelText("change-selected-image-queries-submit").click();
}

export async function changeQueryForSelectedImages(query: string) {
  clickMoreSelectOptionsDropdown();
  await waitFor(() => screen.getByText("Change Query").click());
  await changeQueries(query);
}

export async function changeImageForSelectedImages(cardName: string) {
  clickMoreSelectOptionsDropdown();
  await waitFor(() => screen.getByText("Change Version").click());
  await waitFor(() => expect(screen.getByText("Option 1")));
  await waitFor(() =>
    within(screen.getByTestId("bulk-grid-selector"))
      .getByAltText(cardName)
      .click()
  );
}

export async function clearQueriesForSelectedImages() {
  clickMoreSelectOptionsDropdown();
  await waitFor(() => screen.getByText("Clear Query").click());
}

export async function deleteSelectedImages() {
  clickMoreSelectOptionsDropdown();
  await waitFor(() => screen.getByText("Delete Cards").click());
}

export async function openSearchSettingsModal() {
  screen.getByText(/Search Settings/).click();
  await waitFor(() => expect(screen.getByText("Search Settings")));
  return screen.getByTestId("search-settings");
}

function getDownloadMenu() {
  return within(screen.getByTestId("right-panel")).getByText("Download", {
    exact: false,
  });
}

async function downloadFile(testId: string) {
  // @ts-ignore
  jest.spyOn(global, "Blob").mockImplementation(function (content, options) {
    return { content, options };
  });
  const downloadMenu = getDownloadMenu();
  downloadMenu.click();
  await waitFor(() => screen.getByTestId(testId).click());
  expect(FileSaver.saveAs).toHaveBeenCalledTimes(1);

  // @ts-ignore
  const [blob, filename] = (FileSaver.saveAs as jest.Mock).mock.calls[0];
  return [blob, filename];
}

export async function downloadXML() {
  return await downloadFile("export-xml-button");
}

export async function downloadDecklist() {
  return await downloadFile("export-decklist-button");
}

//# endregion

//# region misc

/**
 * Pretty gross, but useful for asserting that generated XMLs are as expected.
 */
export function normaliseString(text: string): string {
  return text.replaceAll(" ", "").replaceAll("\n", "").replaceAll("\r", "");
}

//# endregion
