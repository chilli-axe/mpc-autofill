import { expect } from "@playwright/test";

import { FaceSeparator, S30 } from "@/common/constants";
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
  configureDefaultBackend,
  downloadXML,
  expectCardbackSlotState,
  expectCardGridSlotState,
  importText,
  navigateToEditor,
  normaliseString,
} from "./test-utils";

test.describe("ExportXML", () => {
  test("the XML representation of a simple project with no custom backs", async ({
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
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, "query 1\nquery 2");
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 1, 1);
    await expectCardbackSlotState(page, cardDocument5.name, 1, 1);

    const [content, filename] = await downloadXML(page);

    expect(normaliseString(content)).toBe(
      normaliseString(
        `<order>
              <details>
                <quantity>2</quantity>
                <bracket>18</bracket>
                <stock>${S30}</stock>
                <foil>false</foil>
              </details>
              <fronts>
                <card>
                    <id>${cardDocument1.identifier}</id>
                    <slots>0</slots>
                    <name>${cardDocument1.name}.${cardDocument1.extension}</name>
                    <query>card one</query>
                </card>
                <card>
                    <id>${cardDocument2.identifier}</id>
                    <slots>1</slots>
                    <name>${cardDocument2.name}.${cardDocument2.extension}</name>
                    <query>card 2</query>
                  </card>
              </fronts>
              <cardback>${cardDocument5.identifier}</cardback>
            </order>`
      )
    );
    expect(filename).toBe("cards.xml");
  });

  test("the XML representation of a simple project with a custom back for one card", async ({
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
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, `query 1\nquery 2${FaceSeparator}t:query 6`);
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument2.name, 1, 1);
    await expectCardGridSlotState(page, 2, "back", cardDocument6.name, 1, 1);
    await expectCardbackSlotState(page, cardDocument5.name, 1, 1);

    const [content, filename] = await downloadXML(page);

    expect(normaliseString(content)).toBe(
      normaliseString(
        `<order>
              <details>
                <quantity>2</quantity>
                <bracket>18</bracket>
                <stock>${S30}</stock>
                <foil>false</foil>
              </details>
              <fronts>
                <card>
                    <id>${cardDocument1.identifier}</id>
                    <slots>0</slots>
                    <name>${cardDocument1.name}.${cardDocument1.extension}</name>
                    <query>card one</query>
                </card>
                <card>
                    <id>${cardDocument2.identifier}</id>
                    <slots>1</slots>
                    <name>${cardDocument2.name}.${cardDocument2.extension}</name>
                    <query>card 2</query>
                  </card>
              </fronts>
              <backs>
                <card>
                    <id>${cardDocument6.identifier}</id>
                    <slots>1</slots>
                    <name>${cardDocument6.name}.${cardDocument6.extension}</name>
                    <query>t:card 6</query>
                </card>
              </backs>
              <cardback>${cardDocument5.identifier}</cardback>
            </order>`
      )
    );
    expect(filename).toBe("cards.xml");
  });

  test("the XML representation of a simple project with multiple instances of a card", async ({
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
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importText(page, `2x query 1\nquery 2${FaceSeparator}query 1`);
    await expectCardGridSlotState(page, 1, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 2, "front", cardDocument1.name, 1, 1);
    await expectCardGridSlotState(page, 3, "front", cardDocument2.name, 1, 1);
    await expectCardGridSlotState(page, 3, "back", cardDocument1.name, 1, 1);
    await expectCardbackSlotState(page, cardDocument5.name, 1, 1);

    const [content, filename] = await downloadXML(page);

    expect(normaliseString(content)).toBe(
      normaliseString(
        `<order>
              <details>
                <quantity>3</quantity>
                <bracket>18</bracket>
                <stock>${S30}</stock>
                <foil>false</foil>
              </details>
              <fronts>
                <card>
                    <id>${cardDocument1.identifier}</id>
                    <slots>0,1</slots>
                    <name>${cardDocument1.name}.${cardDocument1.extension}</name>
                    <query>card one</query>
                </card>
                <card>
                    <id>${cardDocument2.identifier}</id>
                    <slots>2</slots>
                    <name>${cardDocument2.name}.${cardDocument2.extension}</name>
                    <query>card 2</query>
                  </card>
              </fronts>
              <backs>
                <card>
                  <id>${cardDocument1.identifier}</id>
                  <slots>2</slots>
                  <name>${cardDocument1.name}.${cardDocument1.extension}</name>
                  <query>card one</query>
                </card>
              </backs>
              <cardback>${cardDocument5.identifier}</cardback>
            </order>`
      )
    );
    expect(filename).toEqual("cards.xml");
  });
});
