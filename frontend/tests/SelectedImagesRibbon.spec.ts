import { expect } from "@playwright/test";

import { FaceSeparator } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  cardDocument5,
} from "@/common/test-constants";
import {
  cardbacksOneOtherResult,
  cardbacksOneResult,
  cardbacksTwoResults,
  cardDocumentsOneResult,
  cardDocumentsSixResults,
  cardDocumentsThreeResults,
  defaultHandlers,
  dfcPairsMatchingCards1And4,
  searchResultsForDFCMatchedCards1And4,
  searchResultsOneResult,
  searchResultsSixResults,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  changeImageForSelectedImages,
  changeQueryForSelectedImages,
  configureDefaultBackend,
  deleteSelectedImages,
  deselectSlot,
  expectCardbackSlotState,
  expectCardGridSlotState,
  expectCardSlotToNotExist,
  importText,
  navigateToEditor,
  selectAll,
  selectSimilar,
  selectSlot,
} from "./test-utils";

test.describe("SelectedImagesRibbon", () => {
  test("selecting a single card and changing its query", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "query 1");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await selectSlot(page, 1, "front");
    await changeQueryForSelectedImages(page, "query 2");
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 1, 1);
  });

  test("selecting multiple cards and changing both of their queries", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "2x query 1");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument1.name, 1, 1);

    await selectSlot(page, 1, "front");
    await selectSlot(page, 2, "front");
    await changeQueryForSelectedImages(page, "query 2");
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 1, 1);
  });

  test("selecting a single card and changing its selected image", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);

    await selectSlot(page, 1, "front");
    await changeImageForSelectedImages(page, cardDocument2.name);
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 2, 3);
  });

  test("selecting multiple cards with the same query and changing both of their selected images", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "2x my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);
    await expectCardGridSlotState(page, 2, "front", cardDocument1.name, 1, 3);

    await selectSlot(page, 1, "front");
    await selectSlot(page, 2, "front");
    await changeImageForSelectedImages(page, cardDocument2.name);
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 2, 3);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 2, 3);
  });

  test("selecting multiple cardbacks and changing both of their selected images", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "2x my search query");
    await expectCardGridSlotState(page, 1, "back", cardDocument1.name, 1, 2);
    await expectCardGridSlotState(page, 2, "back", cardDocument1.name, 1, 2);

    await selectSlot(page, 1, "back");
    await selectSlot(page, 2, "back");
    await changeImageForSelectedImages(page, cardDocument2.name);
    await expectCardGridSlotState(page, 1, "back", cardDocument2.name, 2, 2);
    await expectCardGridSlotState(page, 2, "back", cardDocument2.name, 2, 2);
  });

  test("cannot change the images of multiple selected images when they don't share the same query", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "query 1\nquery 2");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 1, 1);

    await selectSlot(page, 1, "front");
    await selectSlot(page, 2, "front");

    await expect(page.getByText("Change Version")).not.toBeVisible();
  });

  test("selecting a single card and deleting it", async ({ page, network }) => {
    network.use(
      cardDocumentsOneResult,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await selectSlot(page, 1, "front");
    await deleteSelectedImages(page);
    await expectCardSlotToNotExist(page, 1);
  });

  test("selecting multiple cards and deleting them", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsOneResult,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "2x my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument1.name, 1, 1);

    await selectSlot(page, 1, "front");
    await selectSlot(page, 2, "front");
    await deleteSelectedImages(page);
    await expectCardSlotToNotExist(page, 1);
    await expectCardSlotToNotExist(page, 2);
  });

  test("selecting then clearing the selection", async ({ page, network }) => {
    network.use(
      cardDocumentsOneResult,
      cardbacksOneResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await selectSlot(page, 1, "front");
    await deselectSlot(page, 1, "front");
  });

  test("selecting then expanding the selection to similar front images", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "2x query 1\n1x query 2");

    await selectSlot(page, 1, "front");
    await selectSimilar(page);

    const element1 = page.getByLabel("select-front0").locator("*").first();
    const element2 = page.getByLabel("select-front1").locator("*").first();
    const element3 = page.getByLabel("select-front2").locator("*").first();
    await expect(element1).toHaveClass(/bi-check-square/);
    await expect(element2).toHaveClass(/bi-check-square/);
    // slot 3 should not have been selected
    await expect(element3).not.toHaveClass(/bi-check-square/);
  });

  test("selecting then expanding the selection to similar back images", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsForDFCMatchedCards1And4,
      dfcPairsMatchingCards1And4,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "1x my search query\n2x card 3");
    // slot 1 uses dfc-pair matching to pair cards 1 and 4, while slots 2 and 3 display card 3 and use the project back
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 1, "back", cardDocument4.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument3.name, 1, 1);
    await expectCardGridSlotState(page, 2, "back", cardDocument5.name, 1, 1);
    await expectCardGridSlotState(page, 3, "front", cardDocument3.name, 1, 1);
    await expectCardGridSlotState(page, 3, "back", cardDocument5.name, 1, 1);

    await selectSlot(page, 2, "back");
    await selectSimilar(page);

    const element1 = page.getByLabel("select-back0").locator("*").first();
    const element2 = page.getByLabel("select-back1").locator("*").first();
    const element3 = page.getByLabel("select-back2").locator("*").first();
    await expect(element2).toHaveClass(/bi-check-square/);
    await expect(element3).toHaveClass(/bi-check-square/);
    // slot 1's back should remain unselected
    await expect(element1).not.toHaveClass(/bi-check-square/);
  });

  test("selecting then expanding the selection to all front images", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "2x query 1\n1x query 2");

    await selectSlot(page, 1, "front");
    await selectAll(page);

    const element1 = page.getByLabel("select-front0").locator("*").first();
    const element2 = page.getByLabel("select-front1").locator("*").first();
    const element3 = page.getByLabel("select-front2").locator("*").first();
    await expect(element1).toHaveClass(/bi-check-square/);
    await expect(element2).toHaveClass(/bi-check-square/);
    await expect(element3).toHaveClass(/bi-check-square/);
  });
});
