import { expect } from "@playwright/test";

import {
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import { loadPageWithDefaultBackend, openImportTextModal } from "../test-utils";

test.describe("ImportText visual tests", () => {
  test("import text modal structure", async ({ page, network }) => {
    network.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    page.addInitScript({ content: "Math.random = () => 1;" });
    await loadPageWithDefaultBackend(page);

    await openImportTextModal(page);

    await expect(page.getByTestId("import-text")).toMatchAriaSnapshot(`
      - text: Add Cards — Text
      - button "Close"
      - paragraph: Type the names of the cards you'd like to add to your order and hit Submit. One card per line.
      - heading "Syntax Guide" [level=2]:
        - button "Syntax Guide"
      - textbox "import-text":
        - /placeholder: "2x Card 1\\n1x Card 2\\n2x Card 3\\n2x Card 4\\n\\n2x t:Card 6\\n\\n1x b:Card 5"
      - paragraph: "Hint: Submit with Control+Enter."
      - button "import-text-submit"
      - button "import-text-close"
    `);
  });
});
