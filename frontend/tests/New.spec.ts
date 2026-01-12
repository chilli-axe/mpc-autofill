import { expect } from "@playwright/test";

import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
} from "@/common/test-constants";
import {
  defaultHandlers,
  newCardsFirstPageWithTwoSources,
  newCardsPageForSource1,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import { configureDefaultBackend, navigateToNew } from "./test-utils";

test.describe("NewCards", () => {
  test("clicking to show another page of results in the new cards page", async ({
    page,
    network,
  }) => {
    network.use(
      newCardsFirstPageWithTwoSources,
      newCardsPageForSource1,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToNew(page);

    await expect(page.getByText(cardDocument1.name)).toBeVisible();
    await expect(page.getByText(cardDocument2.name)).toBeVisible();
    await expect(page.getByText(cardDocument3.name)).not.toBeVisible();
    await expect(page.getByText(cardDocument4.name)).not.toBeVisible();

    await page.getByText("Load More").click();

    await expect(page.getByText(cardDocument3.name)).toBeVisible();
    await expect(page.getByText(cardDocument4.name)).toBeVisible();
    await expect(page.getByText("Load More")).not.toBeVisible();
  });
});
