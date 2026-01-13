import { expect } from "@playwright/test";

import { FaceSeparator, SelectedImageSeparator } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
} from "@/common/test-constants";
import {
  cardbacksOneOtherResult,
  cardbacksTwoResults,
  cardDocumentsOneResult,
  cardDocumentsSixResults,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsOneResult,
  searchResultsSixResults,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  changeQueries,
  expectCardbackSlotState,
  expectCardGridSlotState,
  expectCardSlotToExist,
  expectCardSlotToNotExist,
  importText,
  loadPageWithDefaultBackend,
  selectSlot,
} from "./test-utils";

test.describe("CardSlot", () => {
  test("switching to the next image in a CardSlot", async ({
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

    await page.getByText("❯").click();

    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 2, 3);
  });

  test("switching to the previous image in a CardSlot", async ({
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
      `my search query${SelectedImageSeparator}${cardDocument2.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 2, 3);

    await page.getByText("❮").click();

    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);
  });

  test("switching images in a CardSlot wraps around", async ({
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
      `my search query${SelectedImageSeparator}${cardDocument2.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 2, 3);

    // page between images and ensure that wrapping around works
    await page.getByText("❯").click();
    await expectCardGridSlotState(page, 1, "front", cardDocument3.name, 3, 3);

    await page.getByText("❯").click();
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);

    await page.getByText("❮").click();
    await expectCardGridSlotState(page, 1, "front", cardDocument3.name, 3, 3);
  });

  test("selecting an image in a CardSlot via the grid selector", async ({
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
      `my search query${SelectedImageSeparator}${cardDocument2.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 2, 3);

    await page.getByText("2 / 3").click();
    await expect(page.getByText("Select Version")).toBeVisible();

    await expect(page.getByText("Option 2")).toBeVisible();
    await expect(page.getByText("Option 3")).toBeVisible();
    await page.getByText("Option 1").click();

    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);
  });

  test("deleting a CardSlot", async ({ page, network }) => {
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
    await expect(page.getByText(cardDocument1.name)).toBeVisible();

    await page.getByLabel("remove-front0").click();

    await expectCardSlotToNotExist(page, 1);
  });

  test("deleting multiple CardSlots", async ({ page, network }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `3x my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardSlotToExist(page, 1);
    await expectCardSlotToExist(page, 2);
    await expectCardSlotToExist(page, 3);

    await page.getByLabel("remove-front0").click();
    await page.getByLabel("remove-front1").click();

    await expectCardSlotToExist(page, 1);
    await expectCardSlotToNotExist(page, 2);
    await expectCardSlotToNotExist(page, 3);
  });

  test("CardSlot uses cardbacks as search results for backs with no search query", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "back", cardDocument1.name, 1, 2);
    await expectCardbackSlotState(page, cardDocument1.name, 1, 2);
  });

  test("CardSlot defaults to project cardback for backs with no search query", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    // Set cardback first
    await page
      .getByTestId("common-cardback")
      .getByRole("button", { name: "❯" })
      .click();
    await expectCardbackSlotState(page, cardDocument2.name, 2, 2);

    // Import card with FaceSeparator (meaning it has front but uses project cardback for back)
    await importText(page, FaceSeparator);
    await expectCardGridSlotState(page, 1, "back", cardDocument2.name, 2, 2);
    await expectCardbackSlotState(page, cardDocument2.name, 2, 2);
  });

  test("double clicking the select button selects all slots for the same query", async ({
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
      `2x my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument1.name, 1, 1);

    await selectSlot(page, 1, "front");
    await selectSlot(page, 1, "front", "double");

    const element1 = page.getByLabel("select-front0").locator("*").first();
    const element2 = page.getByLabel("select-front1").locator("*").first();
    await expect(element1).toHaveClass(/bi-check-square/);
    await expect(element2).toHaveClass(/bi-check-square/);
  });

  test("changing a card slot's query", async ({ page, network }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `query 1${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await page.getByText(cardDocument1.name).click();
    await changeQueries(page, "query 2");
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 1, 1);
  });

  test("clearing a card slot's query", async ({ page, network }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `query 1${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await page.getByText(cardDocument1.name).click();
    await changeQueries(page, "");
    await expectCardGridSlotState(
      page,
      1,
      "front",
      undefined,
      undefined,
      undefined
    );
  });

  test("changing a card slot's query doesn't affect a different slot", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `query 1${SelectedImageSeparator}${cardDocument1.identifier}\nquery 2${SelectedImageSeparator}${cardDocument2.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 1, 1);

    // Click on the FIRST slot's card name (there are multiple cardDocument1.name on the page)
    await page.getByTestId("front-slot0").getByText(cardDocument1.name).click();
    await changeQueries(page, "query 3");
    await expectCardGridSlotState(page, 1, "front", cardDocument3.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 1, 1);
  });

  test("selecting then shift-clicking to expand the selection downwards", async ({
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
    await loadPageWithDefaultBackend(page);

    await importText(page, "2x query 1\n1x query 2");

    await selectSlot(page, 1, "front");
    await selectSlot(page, 3, "front", "shift");

    const element1 = page.getByLabel("select-front0").locator("*").first();
    const element2 = page.getByLabel("select-front1").locator("*").first();
    const element3 = page.getByLabel("select-front2").locator("*").first();
    await expect(element1).toHaveClass(/bi-check-square/);
    await expect(element2).toHaveClass(/bi-check-square/);
    await expect(element3).toHaveClass(/bi-check-square/);
  });

  test("selecting then shift-clicking to expand the selection upwards", async ({
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
    await loadPageWithDefaultBackend(page);

    await importText(page, "2x query 1\n1x query 2");

    await selectSlot(page, 3, "front");
    await selectSlot(page, 1, "front", "shift");

    const element1 = page.getByLabel("select-front0").locator("*").first();
    const element2 = page.getByLabel("select-front1").locator("*").first();
    const element3 = page.getByLabel("select-front2").locator("*").first();
    await expect(element1).toHaveClass(/bi-check-square/);
    await expect(element2).toHaveClass(/bi-check-square/);
    await expect(element3).toHaveClass(/bi-check-square/);
  });

  test("the most recently selected card is tracked correctly", async ({
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
    await loadPageWithDefaultBackend(page);

    await importText(page, "5x query 1");

    await selectSlot(page, 5, "front");
    await selectSlot(page, 1, "front");
    await selectSlot(page, 3, "front", "shift"); // should select 2 and 3, not 3 and 4

    const element2 = page.getByLabel("select-front1").locator("*").first();
    const element3 = page.getByLabel("select-front2").locator("*").first();
    const element4 = page.getByLabel("select-front3").locator("*").first();
    await expect(element2).toHaveClass(/bi-check-square/);
    await expect(element3).toHaveClass(/bi-check-square/);
    await expect(element4).not.toHaveClass(/bi-check-square/);
  });

  test("CardSlot automatically selects the first search result", async ({
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

    await importText(page, "my search query");

    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);
  });

  test("CardSlot automatically deselects invalid image then selects the first search result", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    // Import with an invalid identifier (cardDocument2 is not in search results)
    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument2.identifier}`
    );

    // Should automatically deselect the invalid image and select the first result
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
  });
});
