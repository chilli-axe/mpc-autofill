import { expect } from "@playwright/test";

import { SelectedImageSeparator } from "@/common/constants";
import { cardDocument1 } from "@/common/test-constants";
import {
  cardDocumentsOneResult,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  configureDefaultBackend,
  expectCardGridSlotState,
  importText,
  navigateToEditor,
} from "../test-utils";

test.describe("CardDetailedViewModal visual tests", () => {
  test("card detailed view modal structure", async ({ page, network }) => {
    network.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await page.getByAltText(cardDocument1.name).click();
    await expect(page.getByText("Card Details")).toBeVisible();
    await expect(page.getByText("English")).toBeVisible();

    await expect(page.getByTestId("detailed-view")).toHaveScreenshot();
  });
});
