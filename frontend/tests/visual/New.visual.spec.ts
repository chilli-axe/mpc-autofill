import { expect } from "@playwright/test";

import { sourceDocument1 } from "@/common/test-constants";
import {
  defaultHandlers,
  newCardsFirstPageNoResults,
  newCardsFirstPageWithTwoSources,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import { loadPageWithDefaultBackend } from "../test-utils";

test.describe("New cards page visual tests", () => {
  test("new cards page with two sources, each with results", async ({
    page,
    network,
  }) => {
    network.use(newCardsFirstPageWithTwoSources, ...defaultHandlers);
    await loadPageWithDefaultBackend(page, "new");

    await expect(
      page.getByText(sourceDocument1.name, { exact: true })
    ).toBeVisible();

    await expect(
      page.getByText("Check out the new cards", { exact: false }).locator("..")
    ).toMatchAriaSnapshot(`
      - paragraph: Check out the new cards added to Test Site in the last two weeks.
      - heading "Source 1" [level=3]:
        - emphasis: Source 1
      - paragraph: 4 new cards
      - paragraph: /1st January, \\d+/
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: /1st January, \\d+/
      - img "Card 2"
      - text: Card 2
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - button "Load More"
      - separator
      - heading "Source 2" [level=3]:
        - emphasis: Source 2
      - paragraph: 1 new card
      - paragraph: /1st January, \\d+/
      - img "Card 5"
      - text: Card 5
      - paragraph: /Source 2 Cardbacks \\[\\d+ DPI\\]/
    `);
  });

  test("new cards page with no data", async ({ page, network }) => {
    network.use(newCardsFirstPageNoResults, ...defaultHandlers);
    await loadPageWithDefaultBackend(page, "new");

    await expect(page.getByText(":(", { exact: false })).toBeVisible();

    await expect(page.getByText(":(", { exact: false }).locator(".."))
      .toMatchAriaSnapshot(`
      - paragraph: Looks like nothing was added to Test Site in the last two weeks. :(
    `);
  });
});
