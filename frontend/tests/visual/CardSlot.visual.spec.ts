import { expect } from "@playwright/test";

import { SelectedImageSeparator } from "@/common/constants";
import { cardDocument1 } from "@/common/test-constants";
import {
  cardDocumentsFourResults,
  cardDocumentsOneResult,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsFourResults,
  searchResultsOneResult,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import {
  expectCardGridSlotState,
  importText,
  loadPageWithDefaultBackend,
  openCardSlotGridSelector,
  selectDropdownOption,
  selectSlot,
} from "../test-utils";

test.describe("CardSlot visual tests", () => {
  test("card slot with single search result, no image selected", async ({
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

    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await expect(page.getByTestId("front-slot0")).toMatchAriaSnapshot(`
      - paragraph: Slot 1
      - button "select-front0"
      - button "remove-front0"
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: 1 / 1
    `);
  });

  test("card slot with single search result, slot selected", async ({
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

    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await selectSlot(page, 1, "front");

    await expect(page.getByTestId("front-slot0")).toMatchAriaSnapshot(`
      - paragraph: Slot 1
      - button "select-front0"
      - button "remove-front0"
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: 1 / 1
    `);
  });

  test("card slot with single search result, image selected", async ({
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
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);

    await expect(page.getByTestId("front-slot0")).toMatchAriaSnapshot(`
      - paragraph: Slot 1
      - button "select-front0"
      - button "remove-front0"
      - img "Card 1"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - paragraph: 1 / 1
    `);
  });

  test("card slot with multiple search results, image selected", async ({
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

    await expect(page.getByTestId("front-slot0")).toMatchAriaSnapshot(`
      - paragraph: Slot 1
      - button "select-front0"
      - button "remove-front0"
      - img "Card 1"
      - img "Card 2"
      - img "Card 3"
      - text: Card 1
      - paragraph: /Source 1 \\[\\d+ DPI\\]/
      - button "1 / 3"
      - button "❮"
      - button "❯"
    `);
  });

  test("card slot grid selector, cards grouped together", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsFourResults,
      sourceDocumentsThreeResults,
      searchResultsFourResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );

    await openCardSlotGridSelector(page, 1, "front", 1, 4);

    await expect(page.getByTestId("front-slot0-grid-selector"))
      .toMatchAriaSnapshot(`
        - text: Select Version — 4 results
        - button " Filters"
        - button "Close"
        - heading "Jump to Version" [level=5]
        - button "":
          - heading "" [level=5]
        - heading "View" [level=5]
        - button "":
          - heading "" [level=5]
        - text: Group by
        - button "None":
          - list:
            - listitem:
              - text: None
              - button "Remove None"
            - listitem: Choose...
          - text: ""
        - text: Card display style
        - button "Compressed Relaxed"
        - heading "Sort" [level=5]
        - button "":
          - heading "" [level=5]
        - button "Choose... ▼":
          - list:
            - listitem: Choose...
          - text: ""
        - heading "Filter" [level=5]
        - button "":
          - heading "" [level=5]
        - text: "Min resolution: 0 DPI"
        - slider: "0"
        - text: "/Max resolution: \\\\d+ DPI/"
        - slider: /\\d+/
        - text: "/File size: Up to \\\\d+ MB/"
        - slider: /\\d+/
        - text: Languages
        - button "Choose... ▼":
          - list:
            - listitem: Choose...
          - text: ""
        - text: Tags which cards must have at least one of
        - button "Choose... ▼":
          - list:
            - listitem: Choose...
          - text: ""
        - text: Tags which cards must not have
        - button "Choose... ▼":
          - list:
            - listitem: Choose...
          - text: ""
        - button "Disable all drives"
        - table:
          - rowgroup:
            - row "Active Name":
              - columnheader "Active"
              - columnheader "Name"
              - columnheader
              - columnheader
          - rowgroup:
            - row "On Off Source 1":
              - cell "On Off":
                - button "On Off"
              - cell "Source 1"
              - cell
              - cell
            - row "On Off Source 2":
              - cell "On Off":
                - button "On Off"
              - cell "Source 2"
              - cell
              - cell
            - row "On Off Source 3":
              - cell "On Off":
                - button "On Off"
              - cell "Source 3"
              - cell
              - cell
        - img "Card 1"
        - img "Card 2"
        - img "Card 3"
        - img "Card 4"
        - button "Close"
      `);
  });

  test("card slot grid selector, cards faceted by source", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsFourResults,
      sourceDocumentsThreeResults,
      searchResultsFourResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(
      page,
      `my search query${SelectedImageSeparator}${cardDocument1.identifier}`
    );

    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 4);

    // Toggle on "Facet by Source"
    const groupByDropdown = gridSelector
      .locator(".react-dropdown-tree-select")
      .first();
    await selectDropdownOption(groupByDropdown, "Source");

    await expect(page.getByTestId("front-slot0-grid-selector"))
      .toMatchAriaSnapshot(`
        - text: Select Version — 4 results
        - button " Filters"
        - button "Close"
        - heading "Jump to Version" [level=5]
        - button "":
          - heading "" [level=5]
        - heading "View" [level=5]
        - button "":
          - heading "" [level=5]
        - text: Group by
        - button "Source":
          - list:
            - listitem:
              - text: Source
              - button "Remove Source"
            - listitem: Choose...
          - text: ""
        - button " Collapse All"
        - text: Card display style
        - button "Compressed Relaxed"
        - heading "Sort" [level=5]
        - button "":
          - heading "" [level=5]
        - button "Choose... ▼":
          - list:
            - listitem: Choose...
          - text: ""
        - heading "Filter" [level=5]
        - button "":
          - heading "" [level=5]
        - text: "Min resolution: 0 DPI"
        - slider: "0"
        - text: "/Max resolution: \\\\d+ DPI/"
        - slider: /\\d+/
        - text: "/File size: Up to \\\\d+ MB/"
        - slider: /\\d+/
        - text: Languages
        - button "Choose... ▼":
          - list:
            - listitem: Choose...
          - text: ""
        - text: Tags which cards must have at least one of
        - button "Choose... ▼":
          - list:
            - listitem: Choose...
          - text: ""
        - text: Tags which cards must not have
        - button "Choose... ▼":
          - list:
            - listitem: Choose...
          - text: ""
        - button "Disable all drives"
        - table:
          - rowgroup:
            - row "Active Name":
              - columnheader "Active"
              - columnheader "Name"
              - columnheader
              - columnheader
          - rowgroup:
            - row "On Off Source 1":
              - cell "On Off":
                - button "On Off"
              - cell "Source 1"
              - cell
              - cell
            - row "On Off Source 2":
              - cell "On Off":
                - button "On Off"
              - cell "Source 2"
              - cell
              - cell
            - row "On Off Source 3":
              - cell "On Off":
                - button "On Off"
              - cell "Source 3"
              - cell
              - cell
        - heading "Source 1" [level=3]
        - heading "4 versions" [level=6]
        - button "":
          - heading "" [level=5]
        - img "Card 1"
        - img "Card 2"
        - img "Card 3"
        - img "Card 4"
        - button "Close"
      `);
  });
});
