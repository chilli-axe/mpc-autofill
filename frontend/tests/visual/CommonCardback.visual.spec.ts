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
  configureDefaultBackend,
  expectCardbackSlotState,
  navigateToEditor,
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
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await expectCardbackSlotState(page, cardDocument1.name, 1, 1);

    await expect(page.getByTestId("common-cardback")).toHaveScreenshot();
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
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await expectCardbackSlotState(page, cardDocument1.name, 1, 2);

    await expect(page.getByTestId("common-cardback")).toHaveScreenshot();
  });
});
