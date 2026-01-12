import { expect } from "@playwright/test";

import { sourceDocument1 } from "@/common/test-constants";
import {
  defaultHandlers,
  newCardsFirstPageNoResults,
  newCardsFirstPageWithTwoSources,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import { configureDefaultBackend, navigateToNew } from "../test-utils";

test.describe("New cards page visual tests", () => {
  test("new cards page with two sources, each with results", async ({
    page,
    network,
  }) => {
    network.use(newCardsFirstPageWithTwoSources, ...defaultHandlers);
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToNew(page);

    await expect(
      page.getByText(sourceDocument1.name, { exact: true })
    ).toBeVisible();

    await expect(
      page.getByText("Check out the new cards", { exact: false }).locator("..")
    ).toHaveScreenshot();
  });

  test("new cards page with no data", async ({ page, network }) => {
    network.use(newCardsFirstPageNoResults, ...defaultHandlers);
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToNew(page);

    await expect(page.getByText(":(", { exact: false })).toBeVisible();

    await expect(
      page.getByText(":(", { exact: false }).locator("..")
    ).toHaveScreenshot();
  });
});
