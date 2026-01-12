import { expect } from "@playwright/test";

import { sourceDocument1 } from "@/common/test-constants";
import {
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  importText,
  loadPageWithDefaultBackend,
  openCardSlotGridSelector,
} from "./test-utils";

test.describe("GridSelectorModal tests", () => {
  test("toggling between faceting cards by source vs grouped together works as expected", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    // Import a card to get the grid selector available
    await importText(page, "my search query");

    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 3);
    await expect(
      gridSelector.getByRole("heading", {
        name: sourceDocument1.name,
        exact: true,
      })
    ).not.toBeVisible();

    await gridSelector.getByText("Grouped Together").click();
    await expect(
      gridSelector.getByRole("heading", {
        name: sourceDocument1.name,
        exact: true,
      })
    ).toBeVisible();
  });

  test("collapsing a source in the faceted view then expanding it works as expected", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    // Import a card to get the grid selector available
    await importText(page, "my search query");

    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 3);
    await page.getByText("Grouped Together").click();

    const header = gridSelector
      .getByRole("heading", { name: sourceDocument1.name, exact: true })
      .locator("xpath=..");
    const btn = header.getByRole("button");
    await expect(btn.getByRole("heading")).toContainClass("rotate-90");

    await btn.click();
    await expect(btn.getByRole("heading")).toContainClass("rotate-neg90");

    await btn.click();
    await expect(btn.getByRole("heading")).toContainClass("rotate-90");
  });

  test("collapsing and expanding all sources works as expected", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    // Import a card to get the grid selector available
    await importText(page, "my search query");

    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 3);
    await page.getByText("Grouped Together").click();
    const header = gridSelector
      .getByRole("heading", { name: sourceDocument1.name, exact: true })
      .locator("xpath=..");
    const btn = header.getByRole("button");

    await expect(btn.getByRole("heading")).toContainClass("rotate-90");

    await gridSelector.getByText("Collapse All").click();
    await expect(btn.getByRole("heading")).toContainClass("rotate-neg90");

    await gridSelector.getByText("Expand All").click();
    await expect(btn.getByRole("heading")).toContainClass("rotate-90");

    await page.getByRole("button").filter({ hasText: /^$/ }).nth(4).click();
  });
});
