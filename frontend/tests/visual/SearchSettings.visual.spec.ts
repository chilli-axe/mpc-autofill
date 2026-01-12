import { expect } from "@playwright/test";

import { cardDocument1, sourceDocument1 } from "@/common/test-constants";
import {
  cardbacksOneResult,
  cardDocumentsOneResult,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  configureDefaultBackend,
  expectCardGridSlotState,
  importText,
  navigateToEditor,
  openSearchSettingsModal,
} from "../test-utils";

test.describe("SearchSettings visual tests", () => {
  test("search settings modal structure", async ({ page, network }) => {
    network.use(
      cardDocumentsOneResult,
      cardbacksOneResult,
      sourceDocumentsThreeResults,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    // Wait for sources to be fetched by importing a card
    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    const searchSettings = await openSearchSettingsModal(page);
    await expect(searchSettings.getByText(sourceDocument1.name)).toBeVisible();

    // Wait until all spinners have finished loading
    await expect(page.locator(".spinner")).toHaveCount(0);

    await expect(searchSettings).toHaveScreenshot();
  });
});
