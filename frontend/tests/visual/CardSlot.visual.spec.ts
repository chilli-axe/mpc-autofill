import { expect } from "@playwright/test";

import { SelectedImageSeparator } from "@/common/constants";
import { cardDocument1 } from "@/common/test-constants";
import {
  cardDocumentsFourResults,
  cardDocumentsOneResult,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsFourResults,
  searchResultsOneResult,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  expectCardGridSlotState,
  importText,
  loadPageWithDefaultBackend,
  openCardSlotGridSelector,
  selectSlot,
} from "../test-utils";

test.describe("CardSlot visual tests", () => {
  test("card slot with single search result, no image selected", async ({
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

    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await expect(page.getByTestId("front-slot0")).toHaveScreenshot();
  });

  test("card slot with single search result, slot selected", async ({
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

    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await selectSlot(page, 1, "front");

    await expect(page.getByTestId("front-slot0")).toHaveScreenshot();
  });

  test("card slot with single search result, image selected", async ({
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

    await expect(page.getByTestId("front-slot0")).toHaveScreenshot();
  });

  test("card slot with multiple search results, image selected", async ({
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

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);

    await expect(page.getByTestId("front-slot0")).toHaveScreenshot();
  });

  test("card slot grid selector, cards faceted by source", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsFourResults,
      sourceDocumentsThreeResults,
      searchResultsFourResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );

    await openCardSlotGridSelector(page, 1, "front", 1, 4);

    await expect(
      page.getByTestId("front-slot0-grid-selector")
    ).toHaveScreenshot();
  });

  test("card slot grid selector, cards grouped together", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsFourResults,
      sourceDocumentsThreeResults,
      searchResultsFourResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );

    await openCardSlotGridSelector(page, 1, "front", 1, 4);

    // Toggle on "Facet by Source"
    await page.getByText("Grouped Together").click();

    await expect(
      page.getByTestId("front-slot0-grid-selector")
    ).toHaveScreenshot();
  });
});
