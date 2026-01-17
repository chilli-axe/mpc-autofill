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

    await expect(page.getByTestId("front-slot0")).toMatchAriaSnapshot(`
      - paragraph: Slot 1
      - button "select-front0"
      - button "remove-front0"
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: 1 / 1
    `);
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

    await expect(page.getByTestId("front-slot0")).toMatchAriaSnapshot(`
      - paragraph: Slot 1
      - button "select-front0"
      - button "remove-front0"
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: 1 / 1
    `);
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

    await expect(page.getByTestId("front-slot0")).toMatchAriaSnapshot(`
      - paragraph: Slot 1
      - button "select-front0"
      - button "remove-front0"
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: 1 / 1
    `);
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

    await expect(page.getByTestId("front-slot0")).toMatchAriaSnapshot(`
      - paragraph: Slot 1
      - button "select-front0"
      - button "remove-front0"
      - img "Card 1"
      - img "Card 2"
      - img "Card 3"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - button "1 / 3"
      - button "❮"
      - button "❯"
    `);
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

    await expect(page.getByTestId("front-slot0-grid-selector"))
      .toMatchAriaSnapshot(`
      - text: Select Version
      - button "Close"
      - separator
      - heading "Jump to Version" [level=4]
      - button "":
        - heading "" [level=4]
      - separator
      - heading "Browse Versions" [level=4]
      - text: Show All Cards...
      - button "Grouped By Source Grouped Together"
      - paragraph: Option 1
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: Option 2
      - img "Card 2"
      - text: Card 2
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: Option 3
      - img "Card 3"
      - text: Card 3
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: Option 4
      - img "Card 4"
      - text: Card 4
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - button "Close"
    `);
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

    await expect(page.getByTestId("front-slot0-grid-selector"))
      .toMatchAriaSnapshot(`
      - text: Select Version
      - button "Close"
      - separator
      - heading "Jump to Version" [level=4]
      - button "":
        - heading "" [level=4]
      - separator
      - heading "Browse Versions" [level=4]
      - text: Show All Cards...
      - button "Grouped By Source Grouped Together"
      - button " Collapse All"
      - separator
      - heading "Source 1" [level=3]
      - heading "4 versions" [level=6]
      - button "":
        - heading "" [level=4]
      - separator
      - paragraph: Option 1
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: Option 2
      - img "Card 2"
      - text: Card 2
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: Option 3
      - img "Card 3"
      - text: Card 3
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: Option 4
      - img "Card 4"
      - text: Card 4
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - button "Close"
    `);
  });
});
