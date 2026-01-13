import { expect, Page } from "@playwright/test";
import { readFile } from "fs/promises";

export const configureBackend = async (page: Page, url: string) => {
  await page.getByLabel("configure-server-btn").click();
  await page.getByRole("textbox", { name: "backend-url" }).click();
  await page.getByRole("textbox", { name: "backend-url" }).fill(url);
  await page.getByRole("button", { name: "submit-backend-url" }).click();
  await expect(
    page.getByTestId("backend-offcanvas").getByRole("alert")
  ).toContainText(`You\'re connected to ${url}`);
  await page
    .getByTestId("backend-offcanvas")
    .getByRole("button", { name: "Close" })
    .click();
};

export const configureDefaultBackend = async (page: Page) =>
  configureBackend(page, "http://127.0.0.1:8000");

export const loadPageWithDefaultBackend = async (
  page: Page,
  pageName: string = "editor"
) => {
  await page.goto(`/${pageName}?server=http://127.0.0.1:8000`);

  // Wait for cookie consent toast to appear and dismiss it
  const optOutButton = page.getByRole("button", { name: "Opt out" });
  await optOutButton.waitFor({ state: "visible" });
  await optOutButton.click();
};

export const navigateToEditor = async (page: Page) =>
  await page.getByRole("link", { name: "Editor" }).click();

export const navigateToNew = async (page: Page) =>
  await page.getByRole("link", { name: "What's New?" }).click();

export const openAddCardsDropdown = async (page: Page) => {
  const textButton = page.getByRole("button", { name: " Text" });
  if (await textButton.isVisible()) {
    return;
  }
  // this looks stupid but actually prevents our tests from being flaky.
  // sometimes playwright is too "fast" (?) and clicking the button doesn't open the dropdown.
  // (the rare human comment amongst the AI slop)
  await expect(async () => {
    await page.getByRole("button", { name: "Add Cards", exact: false }).click();
    await expect(textButton).toBeVisible();
  }).toPass({ timeout: 10_000 });
};

export const openImportTextModal = async (page: Page) => {
  await openAddCardsDropdown(page);
  const textButton = await page.getByRole("button", { name: " Text" }).click();
};

export const importText = async (page: Page, text: string) => {
  await openImportTextModal(page);
  await page.getByRole("textbox", { name: "import-text" }).fill(text);
  await page.getByRole("button", { name: "import-text-submit" }).click();
  await expect(
    page.locator('span:has-text("Loading your cards...")')
  ).not.toBeVisible();
};

export async function expectCardSlotToExist(page: Page, slot: number) {
  await expect(page.getByTestId(`front-slot${slot - 1}`)).toContainText(
    `Slot ${slot}`
  );
  await expect(page.getByTestId(`back-slot${slot - 1}`)).toContainText(
    `Slot ${slot}`
  );
}

export async function expectCardSlotToNotExist(page: Page, slot: number) {
  await expect(page.getByTestId(`front-slot${slot - 1}`)).not.toBeVisible();
  await expect(page.getByTestId(`back-slot${slot - 1}`)).not.toBeVisible();
}

export const expectCardSlotState = async (
  page: Page,
  testId: string,
  cardName?: string,
  selectedImage?: number,
  totalImages?: number
) => {
  await expect(page.getByTestId(testId)).toContainText(
    cardName ?? "Your search query"
  );
  if (selectedImage !== undefined && totalImages !== undefined) {
    await expect(page.getByTestId(testId)).toContainText(
      `${selectedImage} / ${totalImages}`
    );
  }
};

export const expectCardbackSlotState = async (
  page: Page,
  cardName?: string,
  selectedImage?: number,
  totalImages?: number
) =>
  expectCardSlotState(
    page,
    "common-cardback",
    cardName,
    selectedImage,
    totalImages
  );

export const expectCardGridSlotState = async (
  page: Page,
  slot: number,
  face: "front" | "back",
  cardName?: string,
  selectedImage?: number,
  totalImages?: number
) => {
  const testId = `${face}-slot${slot - 1}`;
  await expect(page.getByTestId(testId)).toContainText(`Slot ${slot}`);
  await expectCardSlotState(page, testId, cardName, selectedImage, totalImages);
};

type CardSlotAssertion = {
  slot: number;
  name: string;
  selectedImage: number;
  totalImages: number;
};

export const toggleFace = async (page: Page) =>
  await page.getByRole("button", { name: "Switch to", exact: false }).click();

export const expectCardGridSlotStates = async (
  page: Page,
  fronts: Array<CardSlotAssertion>,
  backs: Array<CardSlotAssertion>
) => {
  for (const { slot, name, selectedImage, totalImages } of fronts) {
    const testId = `front-slot${slot - 1}`;
    await expect(page.getByTestId(testId)).toContainText(`Slot ${slot}`);
    await expectCardSlotState(page, testId, name, selectedImage, totalImages);
  }

  await toggleFace(page);

  for (const { slot, name, selectedImage, totalImages } of backs) {
    const testId = `back-slot${slot - 1}`;
    await expect(page.getByTestId(testId)).toContainText(`Slot ${slot}`);
    await expectCardSlotState(page, testId, name, selectedImage, totalImages);
  }

  await toggleFace(page);
};

export const openImportCSVModal = async (page: Page) => {
  await openAddCardsDropdown(page);
  await page.getByRole("button", { name: "CSV", exact: false }).click();
};

export const importCSV = async (page: Page, fileContents: string) => {
  await openImportCSVModal(page);
  const fileInput = page.locator('input[type="file"]').first();

  // Create a temporary file with the CSV content
  const buffer = Buffer.from(fileContents);
  await fileInput.setInputFiles({
    name: "test.csv",
    mimeType: "text/csv",
    buffer: buffer,
  });

  await expect(
    page.locator('span:has-text("Loading your cards...")')
  ).not.toBeVisible();
};

export const openImportXMLModal = async (page: Page) => {
  await openAddCardsDropdown(page);
  await page.getByRole("button", { name: "XML", exact: false }).click();
};

export const importXML = async (
  page: Page,
  fileContents: string,
  useXMLCardback: boolean = false
) => {
  await openImportXMLModal(page);

  if (useXMLCardback) {
    await page.getByText("Retain Selected Cardback").click();
  }

  const fileInput = page.locator('input[type="file"]').first();

  // Create a temporary file with the XML content
  const buffer = Buffer.from(fileContents);
  await fileInput.setInputFiles({
    name: "test.xml",
    mimeType: "text/xml;charset=utf-8",
    buffer: buffer,
  });

  await expect(
    page.locator('span:has-text("Loading your cards...")')
  ).not.toBeVisible();
};

export const downloadXML = async (page: Page): Promise<[string, string]> => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: " Download" }).click();
  await page.getByTestId("export-xml-button").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Download path is null");
  const content = await readFile(path, "utf-8");
  return [content, download.suggestedFilename()];
};

export const downloadDecklist = async (
  page: Page
): Promise<[string, string]> => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: " Download" }).click();
  await page.getByTestId("export-decklist-button").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Download path is null");
  const content = await readFile(path, "utf-8");
  return [content, download.suggestedFilename()];
};

export function normaliseString(text: string): string {
  return text.replaceAll(" ", "").replaceAll("\n", "").replaceAll("\r", "");
}

export const openChangeQueryModal = async (
  page: Page,
  cardSlotTestId: string,
  cardName: string
) => {
  await page.getByTestId(cardSlotTestId).getByText(cardName).click();
  return page.getByTestId("change-query-modal");
};

export const changeQueries = async (page: Page, query: string) => {
  const textField = page.getByLabel("change-selected-image-queries-text");
  await textField.clear();
  if (query !== "") {
    await textField.fill(query);
  }
  await page.getByLabel("change-selected-image-queries-submit").click();
};

export const changeQuery = async (
  page: Page,
  cardSlotTestId: string,
  cardName: string,
  newQuery: string
) => {
  await openChangeQueryModal(page, cardSlotTestId, cardName);
  await changeQueries(page, newQuery);
};

export const selectSlot = async (
  page: Page,
  slot: number,
  face: "front" | "back",
  clickType: "double" | "shift" | null = null
) => {
  const selectLabel = `select-${face}${slot - 1}`;
  const element = page.getByLabel(selectLabel).locator("*").first();

  if (face === "back") {
    await toggleFace(page);
  }
  if (clickType === "double") {
    await element.dispatchEvent("click", { detail: 2 });
  } else if (clickType === "shift") {
    await element.click({ modifiers: ["Shift"] });
  } else {
    await element.click();
  }
  if (face === "back") {
    await toggleFace(page);
  }

  await expect(element).toHaveClass(/bi-check-square/);
};

export const deselectSlot = async (
  page: Page,
  slot: number,
  face: "front" | "back"
) => {
  const selectLabel = `select-${face}${slot - 1}`;
  const element = page.getByLabel(selectLabel).locator("*").first();
  await element.click();
  await expect(element).toHaveClass(/bi-square/);
};

export const openCardSlotGridSelector = async (
  page: Page,
  slot: number,
  face: "front" | "back",
  selectedImage: number,
  totalImages: number
) => {
  expect(totalImages).toBeGreaterThan(1);
  const testId = `${face}-slot${slot - 1}`;
  await expect(page.getByTestId(testId)).toContainText(`Slot ${slot}`);
  await expect(page.getByTestId(testId)).toContainText(
    `${selectedImage} / ${totalImages}`
  );

  await page
    .getByTestId(testId)
    .getByText(`${selectedImage} / ${totalImages}`)
    .click();
  await expect(page.getByText("Option 1")).toBeVisible();

  return page.getByTestId(`${face}-slot${slot - 1}-grid-selector`);
};

export const clickMoreSelectOptionsDropdown = async (page: Page) => {
  await page.getByTestId("more-select-options").click();
};

export const selectSimilar = async (page: Page) => {
  await page.getByText("Select Similar").click();
};

export const selectAll = async (page: Page) => {
  await page.getByText("Select All").click();
};

export const changeQueryForSelectedImages = async (
  page: Page,
  query: string
) => {
  await page.getByText("Change Query").click();
  await changeQueries(page, query);
};

export const changeImageForSelectedImages = async (
  page: Page,
  cardName: string
) => {
  await page.getByText("Change Version").click();
  await expect(page.getByText("Option 1")).toBeVisible();
  await page.getByTestId("bulk-grid-selector").getByAltText(cardName).click();
};

export const clearQueriesForSelectedImages = async (page: Page) => {
  await page.getByText("Clear Query").click();
};

export const deleteSelectedImages = async (page: Page) => {
  await page.getByText("Delete Cards").click();
};

export const getErrorToast = async (page: Page) => {
  return page.getByText("An Error Occurred").locator("..").locator("..");
};

export const getAddCardsMenu = (page: Page) => {
  return page
    .getByTestId("right-panel")
    .getByText("Add Cards", { exact: false });
};

export const openSearchSettingsModal = async (page: Page) => {
  await page.getByText(/Search Settings/).click();
  await expect(
    page.getByTestId("search-settings").getByText("Search Settings")
  ).toBeVisible();
  return page.getByTestId("search-settings");
};
