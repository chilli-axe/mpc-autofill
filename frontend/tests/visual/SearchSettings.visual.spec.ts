import { expect } from "@playwright/test";

import { cardDocument1, sourceDocument1 } from "@/common/test-constants";
import {
  cardbacksOneResult,
  cardDocumentsOneResult,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  expectCardGridSlotState,
  importText,
  loadPageWithDefaultBackend,
  openSearchSettingsModal,
} from "../test-utils";

test.describe("SearchSettings visual tests", () => {
  test("search settings modal structure", async ({ page, network }) => {
    network.use(
      cardDocumentsOneResult,
      cardbacksOneResult,
      sourceDocumentsThreeResults,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    // Wait for sources to be fetched by importing a card
    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    const searchSettings = await openSearchSettingsModal(page);
    await expect(searchSettings.getByText(sourceDocument1.name)).toBeVisible();

    // Wait until all spinners have finished loading
    await expect(page.locator(".spinner")).toHaveCount(0);

    await expect(searchSettings).toMatchAriaSnapshot(`
      - text: Search Settings
      - button "Close"
      - heading "Search Type" [level=5]
      - text: Configure how closely the search results should match your query.
      - button "Fuzzy (Forgiving) Search Precise Search"
      - button "Filters Apply to Cardbacks Include All Cardbacks"
      - separator
      - heading "Filters" [level=5]
      - text: "/Configure the DPI \\\\(dots per inch\\\\) and file size ranges the search results must be within\\\\. At a fixed physical size, a higher DPI yields a higher resolution print\\\\. MakePlayingCards prints cards up to \\\\d+ DPI, meaning an \\\\d+ DPI print and a \\\\d+ DPI print will look the same\\\\. Minimum: 0 DPI/"
      - slider: "0"
      - text: "/Maximum: \\\\d+ DPI/"
      - slider: /\\d+/
      - text: "/File size: Up to \\\\d+ MB/"
      - slider: /\\d+/
      - text: Configure the languages and tags to filter the search results on. Select languages
      - button "Choose... ▼":
        - list:
          - listitem: Choose...
        - text: ""
      - text: Select tags which cards must have at least one of
      - button "Choose... ▼":
        - list:
          - listitem: Choose...
        - text: ""
      - text: Select tags which cards must not have
      - button "Choose... ▼":
        - list:
          - listitem: Choose...
        - text: ""
      - separator
      - heading "Contributors" [level=5]
      - text: Configure the contributors to include in the search results.
      - list:
        - listitem: Drag & drop them to change the order they're searched in.
        - listitem: Use the arrows to send a source to the top or bottom.
      - button "Disable all drives"
      - table:
        - rowgroup:
          - row "Active Name":
            - columnheader "Active"
            - columnheader "Name"
            - columnheader
            - columnheader
        - rowgroup:
          - button "On Off Source 1   ":
            - cell "On Off":
              - button "On Off"
            - cell "Source 1"
            - cell " "
            - cell ""
          - button "On Off Source 2   ":
            - cell "On Off":
              - button "On Off"
            - cell "Source 2"
            - cell " "
            - cell ""
          - button "On Off Source 3   ":
            - cell "On Off":
              - button "On Off"
            - cell "Source 3"
            - cell " "
            - cell ""
      - button "Close Without Saving"
      - button "Save Changes"
    `);
  });
});
