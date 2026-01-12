import { expect, Page } from "@playwright/test";

export const configureBackend = async (page: Page, url: string) => {
  await page.getByLabel("configure-server-btn").click();
  await page.getByRole("textbox", { name: "backend-url" }).click();
  await page.getByRole("textbox", { name: "backend-url" }).fill(url);
  await page.getByRole("button", { name: "submit-backend-url" }).click();
  await expect(
    page.getByTestId("backend-offcanvas").getByRole("alert")
  ).toContainText(`You\'re connected to ${url}`);
  await page.getByRole("button", { name: "Close" }).click();
};

export const configureDefaultBackend = async (page: Page) =>
  configureBackend(page, "http://127.0.0.1:8000");

export const navigateToEditor = async (page: Page) =>
  page.getByRole("link", { name: "Editor" }).click();

export const openImportTextModal = async (page: Page) => {
  await page.getByRole("button", { name: "Add Cards", exact: false }).click();
  await page.getByRole("button", { name: "Text", exact: false }).click();
};

export const importText = async (page: Page, text: string) => {
  await openImportTextModal(page);
  await page.getByRole("textbox", { name: "import-text" }).fill(text);
  await page.getByRole("button", { name: "import-text-submit" }).click();
  // await page.waitForSelector("Loading your cards...", {state: "detached"});
  await expect(page.getByText("Loading your cards...")).not.toBeVisible();
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

type CardSlotAssertion = {
  slot: number;
  name: string;
  selectedImage: number;
  totalImages: number;
};

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

  await page.getByRole("button", { name: "Switch to Backs Switch to" }).click();

  for (const { slot, name, selectedImage, totalImages } of backs) {
    const testId = `back-slot${slot - 1}`;
    await expect(page.getByTestId(testId)).toContainText(`Slot ${slot}`);
    await expectCardSlotState(page, testId, name, selectedImage, totalImages);
  }
};
