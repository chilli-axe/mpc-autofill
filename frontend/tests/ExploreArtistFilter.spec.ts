import { expect } from "@playwright/test";

import { cardDocument1, cardDocument2 } from "@/common/test-constants";
import {
  artistsTwoResults,
  defaultHandlers,
  exploreSearchThreeResultsFilterableByArtistAlpha,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import { loadPageWithDefaultBackend } from "./test-utils";

test.describe("Explore artist filter", () => {
  test("typing an artist filters explore results to their work", async ({
    page,
    network,
  }) => {
    network.use(
      artistsTwoResults,
      exploreSearchThreeResultsFilterableByArtistAlpha,
      sourceDocumentsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page, "explore");

    // unfiltered: all three cards
    await expect(page.getByText("3 results")).toBeVisible();
    await expect(page.getByText(cardDocument2.name)).toBeVisible();

    // type an artist name into the artist filter
    await page.getByRole("combobox", { name: "Artist" }).fill("Artist Alpha");

    // filtered: only the card by that artist
    await expect(page.getByText("1 result", { exact: false })).toBeVisible();
    await expect(page.getByText(cardDocument1.name)).toBeVisible();
    await expect(page.getByText(cardDocument2.name)).not.toBeVisible();
  });

  test("clearing the artist filter restores unfiltered results", async ({
    page,
    network,
  }) => {
    network.use(
      artistsTwoResults,
      exploreSearchThreeResultsFilterableByArtistAlpha,
      sourceDocumentsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page, "explore");

    const artistInput = page.getByRole("combobox", { name: "Artist" });
    await artistInput.fill("Artist Alpha");
    await expect(page.getByText("1 result", { exact: false })).toBeVisible();

    await artistInput.clear();
    await expect(page.getByText("3 results")).toBeVisible();
  });
});
