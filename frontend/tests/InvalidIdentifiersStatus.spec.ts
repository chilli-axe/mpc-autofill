import { expect } from "@playwright/test";

import { SelectedImageSeparator } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument5,
} from "@/common/test-constants";
import {
  cardDocumentsOneResult,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsOneResult,
  searchResultsSixResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  changeQuery,
  expectCardGridSlotState,
  expectCardSlotToExist,
  importText,
  loadPageWithDefaultBackend,
} from "./test-utils";

test.describe("InvalidIdentifiersStatus tests", () => {
  const testCases = [
    {
      query: `my search query${SelectedImageSeparator}${cardDocument1.identifier}`,
      problematicImageCount: 0,
    },
    {
      query: `my search query${SelectedImageSeparator}garbage`,
      problematicImageCount: 1,
    },
    {
      query: `2 my search query${SelectedImageSeparator}garbage`,
      problematicImageCount: 2,
    },
    {
      query: `my search query${SelectedImageSeparator}${cardDocument1.identifier}\nmy search query${SelectedImageSeparator}garbage`,
      problematicImageCount: 1,
    },
  ];

  for (const { query, problematicImageCount } of testCases) {
    test(`invalid identifiers status is displayed appropriately (${query}, ${problematicImageCount})`, async ({
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

      await importText(page, query);
      await expectCardSlotToExist(page, 1);
      await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

      if (problematicImageCount > 0) {
        const warningText = await page
          .getByText("Your project specified", { exact: false })
          .textContent();
        expect(warningText).toBe(
          `Your project specified ${problematicImageCount} card version${
            problematicImageCount != 1 ? "s" : ""
          } which couldn't be found.`
        );
      } else {
        await expect(
          page.getByText("Your project specified", { exact: false })
        ).not.toBeVisible();
      }
    });
  }

  test("invalid identifiers status is not displayed when changing query", async ({
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
      `query 1${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardSlotToExist(page, 1);
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    // change query - type in "query 2"
    await changeQuery(page, "front-slot0", cardDocument1.name, "query 2");
    // expect the slot to have changed from card 1 to card 2
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 1, 1);

    // expect the invalid card warning to *not* have been raised
    await expect(
      page.getByText("Your project specified", { exact: false })
    ).not.toBeVisible();
  });
});
