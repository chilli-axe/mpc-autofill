import { expect } from "@playwright/test";

import { FaceSeparator, SelectedImageSeparator } from "@/common/constants";
import { cardDocument5 } from "@/common/test-constants";
import {
  cardDocumentsSixResults,
  defaultHandlers,
  searchResultsSixResults,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  expectCardSlotToExist,
  importText,
  loadPageWithDefaultBackend,
} from "../test-utils";

test.describe("InvalidIdentifiersModal visual tests", () => {
  test("invalid identifiers modal displays the appropriate data", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      sourceDocumentsThreeResults,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `2x query 1${SelectedImageSeparator}123\n1 query 2${FaceSeparator}query 3${SelectedImageSeparator}456`
    );
    await expectCardSlotToExist(page, 1);
    await expectCardSlotToExist(page, 2);
    await expectCardSlotToExist(page, 3);

    // Bring up the modal
    const alertText = page.getByText("Your project specified", {
      exact: false,
    });
    await alertText.locator("..").getByText("Review Invalid Cards").click();
    await expect(
      page.getByText("Invalid Cards", { exact: true })
    ).toBeVisible();

    // Take screenshot of the modal content
    const modalText = page.getByText(
      "Some card versions you specified couldn't be found",
      { exact: false }
    );
    await expect(modalText.locator("..").locator("..")).toHaveScreenshot();
  });
});
