import FileSaver from "file-saver";

import { Back, FaceSeparator, Front, S30 } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument5,
  cardDocument6,
} from "@/common/test-constants";
import {
  downloadXML,
  expectCardbackSlotState,
  expectCardGridSlotState,
  importText,
  normaliseString,
  renderWithProviders,
} from "@/common/test-utils";
import ProjectEditor from "@/components/ProjectEditor";
import {
  cardbacksOneOtherResult,
  cardDocumentsSixResults,
  defaultHandlers,
  searchResultsSixResults,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

beforeEach(() => {
  jest.spyOn(FileSaver, "saveAs");
});

test("the XML representation of a simple project with no custom backs", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("query 1\nquery 2");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument2.name, 1, 1);
  await expectCardbackSlotState(cardDocument5.name, 1, 1);

  const [blob, filename] = await downloadXML();

  expect(blob.options).toEqual({ type: "text/xml;charset=utf-8" });
  expect(normaliseString(blob.content[0])).toBe(
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
                    <query>card 1</query>
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

test("the XML representation of a simple project with a custom back for one card", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText(`query 1\nquery 2 ${FaceSeparator} t:query 6`);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument2.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument6.name, 1, 1);
  await expectCardbackSlotState(cardDocument5.name, 1, 1);

  const [blob, filename] = await downloadXML();

  expect(blob.options).toEqual({ type: "text/xml;charset=utf-8" });
  expect(normaliseString(blob.content[0])).toBe(
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
                    <query>card 1</query>
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

test("the XML representation of a simple project with multiple instances of a card", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText(`2x query 1\nquery 2 ${FaceSeparator} query 1`);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(3, Front, cardDocument2.name, 1, 1);
  await expectCardGridSlotState(3, Back, cardDocument1.name, 1, 1);
  await expectCardbackSlotState(cardDocument5.name, 1, 1);

  const [blob, filename] = await downloadXML();

  expect(blob.options).toEqual({ type: "text/xml;charset=utf-8" });
  expect(normaliseString(blob.content[0])).toBe(
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
                    <query>card 1</query>
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
                  <query>card 1</query>
                </card>
              </backs>
              <cardback>${cardDocument5.identifier}</cardback>
            </order>`
    )
  );
  expect(filename).toBe("cards.xml");
});
