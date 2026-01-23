import { expect } from "@playwright/test";

import { SelectedImageSeparator } from "@/common/constants";
import { cardDocument1 } from "@/common/test-constants";
import {
  cardDocumentsOneResult,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  expectCardGridSlotState,
  importText,
  loadPageWithDefaultBackend,
} from "./test-utils";

const openDetailedView = async (page: any, cardName: string) => {
  await page.getByAltText(cardName).click();
  await expect(page.getByText("Card Details")).toBeVisible();
};

const closeDetailedView = async (page: any) => {
  await page.getByTestId("detailed-view").getByLabel("Close").click();
};

test.describe("AddCardToFavorites tests", () => {
  test("renders Add to Favorites button when card is not a favorite", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await openDetailedView(page, cardDocument1.name);

    const button = page.getByRole("button", { name: /Add to Favorites/i });
    await expect(button).toBeVisible();
    await expect(button).toHaveClass(/btn-outline-info/);
  });

  test("adding card to favorites", async ({ page, network }) => {
    network.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await openDetailedView(page, cardDocument1.name);

    // Initially shows "Add to Favorites"
    const button = page.getByRole("button", { name: /Add to Favorites/i });
    await expect(button).toBeVisible();

    // Click the button
    await button.click();

    // Should update to show "Remove from Favorites"
    await expect(
      page.getByRole("button", { name: /Remove from Favorites/i })
    ).toBeVisible();

    // Should show notification
    await expect(page.getByText("Added to Favorites")).toBeVisible();
    await expect(
      page.getByText(`Added ${cardDocument1.name} to your favorites!`)
    ).toBeVisible();

    // Button should have info variant (not outline)
    await expect(
      page.getByRole("button", { name: /Remove from Favorites/i })
    ).toHaveClass(/btn-info/);
  });

  test("removing card from favorites", async ({ page, network }) => {
    network.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await openDetailedView(page, cardDocument1.name);

    // First add to favorites
    const addButton = page.getByRole("button", { name: /Add to Favorites/i });
    await addButton.click();
    await expect(
      page.getByRole("button", { name: /Remove from Favorites/i })
    ).toBeVisible();

    // Now remove from favorites
    const removeButton = page.getByRole("button", {
      name: /Remove from Favorites/i,
    });
    await removeButton.click();

    // Should update to show "Add to Favorites"
    await expect(
      page.getByRole("button", { name: /Add to Favorites/i })
    ).toBeVisible();

    // Should show notification
    await expect(page.getByText("Removed from Favorites")).toBeVisible();
    await expect(
      page.getByText(`Removed ${cardDocument1.name} from your favorites.`)
    ).toBeVisible();

    // Button should have outline-info variant
    await expect(
      page.getByRole("button", { name: /Add to Favorites/i })
    ).toHaveClass(/btn-outline-info/);
  });

  test("toggling favorite status multiple times", async ({ page, network }) => {
    network.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await openDetailedView(page, cardDocument1.name);

    // First click: Add to favorites
    await page.getByRole("button", { name: /Add to Favorites/i }).click();
    await expect(
      page.getByRole("button", { name: /Remove from Favorites/i })
    ).toBeVisible();

    // Second click: Remove from favorites
    await page.getByRole("button", { name: /Remove from Favorites/i }).click();
    await expect(
      page.getByRole("button", { name: /Add to Favorites/i })
    ).toBeVisible();

    // Third click: Add to favorites again
    await page.getByRole("button", { name: /Add to Favorites/i }).click();
    await expect(
      page.getByRole("button", { name: /Remove from Favorites/i })
    ).toBeVisible();
  });

  test("favorites state persists after closing and reopening detailed view", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    // Open detailed view and add to favorites
    await openDetailedView(page, cardDocument1.name);
    await page.getByRole("button", { name: /Add to Favorites/i }).click();
    await expect(
      page.getByRole("button", { name: /Remove from Favorites/i })
    ).toBeVisible();

    // Close the detailed view
    await closeDetailedView(page);

    // Reopen the detailed view
    await openDetailedView(page, cardDocument1.name);

    // Should still show as a favorite
    await expect(
      page.getByRole("button", { name: /Remove from Favorites/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Remove from Favorites/i })
    ).toHaveClass(/btn-info/);
  });
});
