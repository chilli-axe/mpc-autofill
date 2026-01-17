import { expect } from "@playwright/test";

import { SelectedImageSeparator } from "@/common/constants";
import { cardDocument1 } from "@/common/test-constants";
import {
  cardDocumentsOneResult,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  expectCardGridSlotState,
  importText,
  loadPageWithDefaultBackend,
} from "../test-utils";

test.describe("CardDetailedViewModal visual tests", () => {
  test("card detailed view modal structure", async ({ page, network }) => {
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

    await page.getByAltText(cardDocument1.name).click();
    await expect(page.getByText("Card Details")).toBeVisible();
    await expect(page.getByText("English")).toBeVisible();

    await expect(page.getByTestId("detailed-view")).toMatchAriaSnapshot(`
      - text: Card Details
      - button "Close"
      - img "Card 1"
      - heading "Card 1" [level=4]
      - table:
        - rowgroup:
          - row "Source Name Source 1":
            - rowheader "Source Name"
            - cell "Source 1"
          - row "Source Type Google Drive":
            - rowheader "Source Type"
            - cell "Google Drive"
          - row "Class Card":
            - rowheader "Class"
            - cell "Card"
          - row "Identifier 1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5":
            - rowheader "Identifier"
            - cell "1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5":
              - code: 1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5
          - row "Language English":
            - rowheader "Language"
            - cell "English"
          - row "Tags Untagged":
            - rowheader "Tags"
            - cell "Untagged"
          - row /Resolution \\d+ DPI/:
            - rowheader "Resolution"
            - cell /\\d+ DPI/
          - row /Date Created 1st January, \\d+/:
            - rowheader "Date Created"
            - cell /1st January, \\d+/
          - row /Date Modified 1st January, \\d+/:
            - rowheader "Date Modified"
            - cell /1st January, \\d+/
          - row /File Size \\d+ MB/:
            - rowheader "File Size"
            - cell /\\d+ MB/
      - button " Download Image"
      - spinbutton: "1"
      - button " Add to Project"
      - button "Close"
    `);
  });
});
