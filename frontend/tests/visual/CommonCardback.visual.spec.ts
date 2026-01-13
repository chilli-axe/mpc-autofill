import { expect } from "@playwright/test";

import { cardDocument1 } from "@/common/test-constants";
import {
  cardbacksOneResult,
  cardbacksTwoResults,
  cardDocumentsOneResult,
  defaultHandlers,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  expectCardbackSlotState,
  loadPageWithDefaultBackend,
} from "../test-utils";

test.describe("CommonCardback visual tests", () => {
  test("common cardback with single search result", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      cardbacksOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await expectCardbackSlotState(page, cardDocument1.name, 1, 1);

    await expect(page.getByTestId("common-cardback")).toMatchAriaSnapshot(`
      - paragraph: Cardback
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: 1 / 1
    `);
  });

  test("common cardback with multiple search results", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      cardbacksTwoResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await expectCardbackSlotState(page, cardDocument1.name, 1, 2);

    await expect(page.getByTestId("common-cardback")).toMatchAriaSnapshot(`
      - paragraph: Cardback
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - button "1 / 2"
      - button "❮"
      - button "❯"
    `);
  });
});
