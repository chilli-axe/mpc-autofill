import { expect } from "@playwright/test";

import { SelectedImageSeparator } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument5,
} from "@/common/test-constants";
import {
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsSixResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  changeQueries,
  configureDefaultBackend,
  expectCardGridSlotState,
  expectCardSlotToExist,
  importText,
  navigateToEditor,
  openChangeQueryModal,
} from "./test-utils";

test.describe("ChangeQueryModal tests", () => {
  test("change one card's query", async ({ page, network }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(
      page,
      `query 1${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardSlotToExist(page, 1);
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    // change query - type in "query 2"
    const modal = await openChangeQueryModal(
      page,
      "front-slot0",
      cardDocument1.name
    );
    await expect(
      modal.getByLabel("change-selected-image-queries-text")
    ).toHaveValue("query 1");
    await changeQueries(page, "query 2");

    // expect the slot to have changed from card 1 to card 2
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 1, 1);
  });
});
