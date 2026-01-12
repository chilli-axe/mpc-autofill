import { expect } from "@playwright/test";

import {
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  configureDefaultBackend,
  navigateToEditor,
  openImportTextModal,
} from "../test-utils";

test.describe("ImportText visual tests", () => {
  test("import text modal structure", async ({ page, network }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    page.addInitScript({ content: "Math.random = () => 1;" });
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await openImportTextModal(page);

    await expect(page.getByTestId("import-text")).toHaveScreenshot();
  });
});
