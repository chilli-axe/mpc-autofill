import { expect } from "@playwright/test";

import { FaceSeparator } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument5,
  cardDocument6,
} from "@/common/test-constants";
import {
  cardbacksOneOtherResult,
  cardDocumentsSixResults,
  defaultHandlers,
  searchResultsSixResults,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  downloadDecklist,
  expectCardbackSlotState,
  expectCardGridSlotState,
  importText,
  loadPageWithDefaultBackend,
  normaliseString,
} from "./test-utils";

test.describe("ExportDecklist", () => {
  test("the decklist representation of a simple project with no custom backs", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsThreeResults,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(page, "query 1\nquery 2\nt:query 5");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 1, 1);
    await expectCardbackSlotState(page, cardDocument5.name, 1, 1);

    const [content, filename] = await downloadDecklist(page);

    // note: tokens are not included in decklists
    expect(normaliseString(content)).toBe(
      normaliseString(
        `1x ${cardDocument1.name}
            1x ${cardDocument2.name}`
      )
    );
    expect(filename).toBe("decklist.txt");
  });

  test("the decklist representation of a simple project with a custom back for one card", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsThreeResults,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(page, `query 1\nquery 2${FaceSeparator}t:query 6`);
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 1, 1);
    await expectCardGridSlotState(page, 2, "back", cardDocument6.name, 1, 1);
    await expectCardbackSlotState(page, cardDocument5.name, 1, 1);

    const [content, filename] = await downloadDecklist(page);

    // note: the custom cardback is not included here because only cards are included in decklists
    expect(normaliseString(content)).toBe(
      normaliseString(
        `1x ${cardDocument1.name}
            1x ${cardDocument2.name}`
      )
    );
    expect(filename).toBe("decklist.txt");
  });

  test("the decklist representation of a simple project with multiple instances of a card", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksOneOtherResult,
      sourceDocumentsThreeResults,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await loadPageWithDefaultBackend(page);

    await importText(page, `2x query 1\nquery 2${FaceSeparator}query 1`);
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 3, "front", cardDocument2.name, 1, 1);
    await expectCardGridSlotState(page, 3, "back", cardDocument1.name, 1, 1);
    await expectCardbackSlotState(page, cardDocument5.name, 1, 1);

    const [content, filename] = await downloadDecklist(page);

    expect(normaliseString(content)).toBe(
      normaliseString(
        `2x ${cardDocument1.name}
            1x ${cardDocument2.name}${FaceSeparator}${cardDocument1.name}`
      )
    );
    expect(filename).toBe("decklist.txt");
  });
});
