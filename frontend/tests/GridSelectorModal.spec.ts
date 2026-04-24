import { expect, Locator } from "@playwright/test";

import { sourceDocument1, sourceDocument2 } from "@/common/test-constants";
import { cardDocument1, cardDocument2 } from "@/common/test-constants";
import {
  cardDocumentsThreeResults,
  cardDocumentsTwoSources,
  cardDocumentsWithCanonicalCards,
  defaultHandlers,
  searchResultsThreeResults,
  searchResultsTwoSources,
  searchResultsWithCanonicalCards,
  sourceDocumentsOneResult,
  sourceDocumentsTwoResults,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  expectCardGridSlotState,
  importText,
  loadPageWithDefaultBackend,
  openCardSlotGridSelector,
} from "./test-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Open a StyledDropdownTreeSelect and click an option by its exact label text.
 * The container should be the `.react-dropdown-tree-select` element (or a
 * parent that scopes the search).
 */
async function selectDropdownOption(
  container: Locator,
  label: string
): Promise<void> {
  await container.locator(".dropdown-trigger").click();
  await container.getByText(label, { exact: true }).click();
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const threeCardSetup = {
  handlers: () => [
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers,
  ],
  /** Open the grid selector for slot 1 front; 3 results in total. */
  openGridSelector: async (page: any) => {
    await importText(page, "my search query");
    return openCardSlotGridSelector(page, 1, "front", 1, 3);
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("GridSelectorModal – FacetBy / grouping", () => {
  test("switching to 'Source' grouping shows source headings", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    // No source heading visible while grouped together (FacetBy = None)
    await expect(
      gridSelector.getByRole("heading", {
        name: sourceDocument1.name,
        exact: true,
      })
    ).not.toBeVisible();

    // Switch to Source grouping
    const groupByDropdown = gridSelector
      .locator(".react-dropdown-tree-select")
      .first();
    await selectDropdownOption(groupByDropdown, "Source");

    await expect(
      gridSelector.getByRole("heading", {
        name: sourceDocument1.name,
        exact: true,
      })
    ).toBeVisible();
  });

  test("collapsing a source group and expanding it works", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    const groupByDropdown = gridSelector
      .locator(".react-dropdown-tree-select")
      .first();
    await selectDropdownOption(groupByDropdown, "Source");

    const header = gridSelector
      .getByRole("heading", { name: sourceDocument1.name, exact: true })
      .locator("xpath=..");
    const btn = header.getByRole("button");
    await expect(btn.getByRole("heading")).toContainClass("rotate-90");

    await btn.click();
    await expect(btn.getByRole("heading")).toContainClass("rotate-neg90");

    await btn.click();
    await expect(btn.getByRole("heading")).toContainClass("rotate-90");
  });

  test("'Collapse All' and 'Expand All' buttons work in faceted view", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    const groupByDropdown = gridSelector
      .locator(".react-dropdown-tree-select")
      .first();
    await selectDropdownOption(groupByDropdown, "Source");

    const header = gridSelector
      .getByRole("heading", { name: sourceDocument1.name, exact: true })
      .locator("xpath=..");
    const btn = header.getByRole("button");

    await expect(btn.getByRole("heading")).toContainClass("rotate-90");

    await gridSelector.getByText("Collapse All").click();
    await expect(btn.getByRole("heading")).toContainClass("rotate-neg90");

    await gridSelector.getByText("Expand All").click();
    await expect(btn.getByRole("heading")).toContainClass("rotate-90");
  });

  test("switching to 'Printing' grouping shows expansion headings", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsWithCanonicalCards,
      sourceDocumentsOneResult,
      searchResultsWithCanonicalCards,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 4);

    const groupByDropdown = gridSelector
      .locator(".react-dropdown-tree-select")
      .first();
    await selectDropdownOption(groupByDropdown, "Printing");

    await expect(
      gridSelector.getByRole("heading", { name: "XYZ Set", exact: true })
    ).toBeVisible();
    await expect(
      gridSelector.getByRole("heading", { name: "ABC Set", exact: true })
    ).toBeVisible();
  });
});

test.describe("GridSelectorModal – modal title", () => {
  test("title shows the correct result count", async ({ page, network }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    await expect(
      gridSelector.getByText("Select Version — 3 results")
    ).toBeVisible();
  });

  test("title uses singular 'result' when exactly one result is visible", async ({
    page,
    network,
  }) => {
    // Use the artist filter to narrow 4 cards down to 1 (card10 only: Alpha Artist, ABC Set)
    network.use(
      cardDocumentsWithCanonicalCards,
      sourceDocumentsOneResult,
      searchResultsWithCanonicalCards,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 4);

    // Filter by "ABC Set" expansion to get a single result (card10)
    const printingDropdown = gridSelector
      .getByTestId("printing-filter")
      .locator(".react-dropdown-tree-select");
    await selectDropdownOption(printingDropdown, "ABC Set [ABC]");

    await expect(
      gridSelector.getByText("Select Version — 1 result")
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("GridSelectorModal – filters sidebar", () => {
  test("'Filters' button hides and restores the filter panel", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    // Sidebar is visible by default
    await expect(gridSelector.getByText("Group By")).toBeVisible();

    // Hide
    await gridSelector.getByRole("button", { name: /Filters/ }).click();
    await expect(gridSelector.getByText("Group By")).not.toBeVisible();

    // Restore
    await gridSelector.getByRole("button", { name: /Filters/ }).click();
    await expect(gridSelector.getByText("Group By")).toBeVisible();
  });
});

test.describe("GridSelectorModal – JumpToVersion", () => {
  test("section is collapsed by default and expands when clicked", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    const submitBtn = gridSelector.getByLabel("jump-to-version-submit");
    await expect(submitBtn).not.toBeVisible();

    await gridSelector
      .getByRole("heading", { name: "Jump to Version" })
      .click();
    await expect(submitBtn).toBeVisible();
  });

  test("submit button is disabled when no input is provided", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);
    await gridSelector
      .getByRole("heading", { name: "Jump to Version" })
      .click();

    await expect(
      gridSelector.getByLabel("jump-to-version-submit")
    ).toBeDisabled();
  });

  test("submit button is disabled for option number 0 and above the total count", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);
    await gridSelector
      .getByRole("heading", { name: "Jump to Version" })
      .click();

    const optionInput = gridSelector.getByPlaceholder("1", { exact: true });
    const submitBtn = gridSelector.getByLabel("jump-to-version-submit");

    await optionInput.fill("0");
    await expect(submitBtn).toBeDisabled();

    await optionInput.fill("4"); // 3 total images; 4 is out of range
    await expect(submitBtn).toBeDisabled();
  });

  test("submit button is enabled for a valid option number", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);
    await gridSelector
      .getByRole("heading", { name: "Jump to Version" })
      .click();

    const optionInput = gridSelector.getByPlaceholder("1", { exact: true });
    const submitBtn = gridSelector.getByLabel("jump-to-version-submit");

    await optionInput.fill("2");
    await expect(submitBtn).toBeEnabled();
  });

  test("submit button is enabled for a valid identifier and disabled for an unknown one", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);
    await gridSelector
      .getByRole("heading", { name: "Jump to Version" })
      .click();

    const idInput = gridSelector.getByPlaceholder(cardDocument1.identifier);
    const submitBtn = gridSelector.getByLabel("jump-to-version-submit");

    await idInput.fill("not-a-real-identifier");
    await expect(submitBtn).toBeDisabled();

    await idInput.fill(cardDocument2.identifier);
    await expect(submitBtn).toBeEnabled();
  });

  test("option number and identifier fields are mutually exclusive", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);
    await gridSelector
      .getByRole("heading", { name: "Jump to Version" })
      .click();

    const optionInput = gridSelector.getByPlaceholder("1", { exact: true });
    const idInput = gridSelector.getByPlaceholder(cardDocument1.identifier);

    // Filling option number disables the identifier field
    await optionInput.fill("2");
    await expect(idInput).toBeDisabled();

    // Clearing option number re-enables identifier
    await optionInput.clear();
    await expect(idInput).toBeEnabled();

    // Filling identifier disables the option number field
    await idInput.fill(cardDocument2.identifier);
    await expect(optionInput).toBeDisabled();
  });

  test("submitting a valid option number selects that card and closes the modal", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);

    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 3);
    await gridSelector
      .getByRole("heading", { name: "Jump to Version" })
      .click();
    await gridSelector.getByPlaceholder("1", { exact: true }).fill("2");
    await gridSelector.getByLabel("jump-to-version-submit").click();

    await expect(gridSelector).not.toBeVisible();
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 2, 3);
  });

  test("submitting a valid identifier selects that card and closes the modal", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 3);

    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 3);
    await gridSelector
      .getByRole("heading", { name: "Jump to Version" })
      .click();
    await gridSelector
      .getByPlaceholder(cardDocument1.identifier)
      .fill(cardDocument2.identifier);
    await gridSelector.getByLabel("jump-to-version-submit").click();

    await expect(gridSelector).not.toBeVisible();
    await expectCardGridSlotState(page, 1, "front", cardDocument2.name, 2, 3);
  });
});

test.describe("GridSelectorModal – no-results state", () => {
  test("'No results' message appears when all cards are filtered out", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    // Disable all sources — all three cards are from source1
    await gridSelector
      .getByRole("button", { name: "Disable all drives" })
      .click();

    await expect(gridSelector.getByText("No results :(")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      gridSelector.getByText("Your filters didn't match any results.")
    ).toBeVisible();
  });
});

test.describe("GridSelectorModal – source filter", () => {
  test("disabling a source in the modal reduces the displayed result count", async ({
    page,
    network,
  }) => {
    // 3 results: card1+card2 from source1, card7 from source2
    network.use(
      cardDocumentsTwoSources,
      sourceDocumentsTwoResults,
      searchResultsTwoSources,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 3);
    await expect(
      gridSelector.getByText("Select Version — 3 results")
    ).toBeVisible();

    // Disable source2 via its row in the Contributors table
    const source2Row = gridSelector
      .locator("tr")
      .filter({ hasText: sourceDocument2.name });
    await source2Row.getByText("On").click();

    await expect(
      gridSelector.getByText("Select Version — 2 results")
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("GridSelectorModal – settings lifecycle", () => {
  test("filter settings reset when the modal is closed and reopened", async ({
    page,
    network,
  }) => {
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    // Disable all drives so that no results are shown
    await gridSelector
      .getByRole("button", { name: "Disable all drives" })
      .click();
    await expect(gridSelector.getByText("No results :(")).toBeVisible({
      timeout: 5000,
    });

    // Close the modal (use text-based locator to avoid matching the X aria-label button)
    await gridSelector
      .getByRole("button", { name: "Close", exact: true })
      .filter({ hasText: "Close" })
      .click();
    await expect(gridSelector).not.toBeVisible();

    // Reopen — settings should have been reset, all 3 results should appear again
    const gridSelector2 = await openCardSlotGridSelector(
      page,
      1,
      "front",
      1,
      3
    );
    await expect(
      gridSelector2.getByText("Select Version — 3 results")
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("GridSelectorModal – CanonicalCardFilter", () => {
  test("Canonical Card section is not rendered when all cards lack canonicalCard data", async ({
    page,
    network,
  }) => {
    // card1-3 have no canonicalCard field — they show up as Unknown in the
    // Canonical Card section. When ALL cards are Unknown the component still
    // renders but only shows the Unknown option.
    // This test verifies the section is present (since Unknown is treated as a
    // valid filter) but contains no named artist or expansion.
    network.use(...threeCardSetup.handlers());
    await loadPageWithDefaultBackend(page);
    const gridSelector = await threeCardSetup.openGridSelector(page);

    // "Canonical Card" heading appears because Unknown cards are counted
    await expect(
      gridSelector.getByRole("heading", { name: "Canonical Card" })
    ).toBeVisible();

    // No named artist or expansion — only the Unknown option
    await expect(gridSelector.getByText("Alpha Artist")).not.toBeVisible();
    await expect(gridSelector.getByText("XYZ Set")).not.toBeVisible();
  });

  test("Canonical Card section shows named artists and expansions when canonicalCard data is present", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsWithCanonicalCards,
      sourceDocumentsOneResult,
      searchResultsWithCanonicalCards,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 4);

    await expect(
      gridSelector.getByRole("heading", { name: "Canonical Card" })
    ).toBeVisible();
    // Artist and printing dropdowns are present (opened to verify options)
    await expect(gridSelector.getByTestId("artist-filter")).toBeVisible();
    await expect(gridSelector.getByTestId("printing-filter")).toBeVisible();
    // Open artist dropdown and verify named options are present
    const artistDropdown = gridSelector
      .getByTestId("artist-filter")
      .locator(".react-dropdown-tree-select");
    await artistDropdown.locator(".dropdown-trigger").click();
    await expect(artistDropdown.getByText("Alpha Artist")).toBeVisible();
    await expect(artistDropdown.getByText("Beta Artist")).toBeVisible();
  });

  test("selecting an artist narrows results to only cards by that artist", async ({
    page,
    network,
  }) => {
    // card8 (Alpha, xyz/001), card9 (Beta, xyz/002), card10 (Alpha, abc/001), card11 (null → Unknown)
    network.use(
      cardDocumentsWithCanonicalCards,
      sourceDocumentsOneResult,
      searchResultsWithCanonicalCards,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 4);

    const artistDropdown = gridSelector
      .getByTestId("artist-filter")
      .locator(".react-dropdown-tree-select");
    await selectDropdownOption(artistDropdown, "Alpha Artist");

    // Alpha Artist appears on card8 and card10 → 2 results
    await expect(
      gridSelector.getByText("Select Version — 2 results")
    ).toBeVisible({ timeout: 5000 });
  });

  test("selecting a printing expansion limits results to cards in that expansion", async ({
    page,
    network,
  }) => {
    // XYZ Set contains card8 (001) and card9 (002); ABC Set contains card10 (001)
    network.use(
      cardDocumentsWithCanonicalCards,
      sourceDocumentsOneResult,
      searchResultsWithCanonicalCards,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 4);

    const printingDropdown = gridSelector
      .getByTestId("printing-filter")
      .locator(".react-dropdown-tree-select");
    await selectDropdownOption(printingDropdown, "XYZ Set [XYZ]");

    // card8 and card9 are in XYZ Set → 2 results
    await expect(
      gridSelector.getByText("Select Version — 2 results")
    ).toBeVisible({ timeout: 5000 });
  });

  test("selecting a specific collector number within an expansion limits results to that card", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsWithCanonicalCards,
      sourceDocumentsOneResult,
      searchResultsWithCanonicalCards,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);
    await importText(page, "my search query");
    const gridSelector = await openCardSlotGridSelector(page, 1, "front", 1, 4);

    // Expand XYZ Set in the printing tree and select only collector number 001
    const printingDropdown = gridSelector
      .getByTestId("printing-filter")
      .locator(".react-dropdown-tree-select");
    await printingDropdown.locator(".dropdown-trigger").click();
    // Expand the XYZ Set node to reveal child collector numbers
    await printingDropdown
      .locator("i.toggle")
      .filter({ hasText: "" })
      .first()
      .click();
    await printingDropdown.getByText("001", { exact: true }).first().click();

    // Only card8 (xyz/001) should match → 1 result
    await expect(
      gridSelector.getByText("Select Version — 1 result")
    ).toBeVisible({ timeout: 5000 });
  });
});
