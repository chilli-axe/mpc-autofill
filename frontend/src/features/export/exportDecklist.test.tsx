import FileSaver from "file-saver";

import App from "@/app/app";
import { Back, FaceSeparator, Front } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument5,
  cardDocument6,
} from "@/common/test-constants";
import {
  downloadDecklist,
  expectCardbackSlotState,
  expectCardGridSlotState,
  importText,
  normaliseString,
  renderWithProviders,
} from "@/common/test-utils";
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

test("the decklist representation of a simple project with no custom backs", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
      },
    },
  });

  await importText("query 1\nquery 2\nt:query 5");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument2.name, 1, 1);
  await expectCardbackSlotState(cardDocument5.name, 1, 1);

  const [blob, filename] = await downloadDecklist();

  expect(blob.options).toEqual({ type: "text/plain;charset=utf-8" });
  expect(normaliseString(blob.content[0])).toBe(
    // note: tokens are not included in decklists
    normaliseString(
      `1x ${cardDocument1.name}
            1x ${cardDocument2.name}`
    )
  );
  expect(filename).toBe("decklist.txt");
});

test("the decklist representation of a simple project with a custom back for one card", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
      },
    },
  });

  await importText(`query 1\nquery 2 ${FaceSeparator} t:query 6`);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument2.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument6.name, 1, 1);
  await expectCardbackSlotState(cardDocument5.name, 1, 1);

  const [blob, filename] = await downloadDecklist();

  expect(blob.options).toEqual({ type: "text/plain;charset=utf-8" });
  expect(normaliseString(blob.content[0])).toBe(
    // note: the custom cardback is not included here because only cards are included in decklists
    normaliseString(
      `1x ${cardDocument1.name}
            1x ${cardDocument2.name}`
    )
  );
  expect(filename).toBe("decklist.txt");
});

test("the decklist representation of a simple project with multiple instances of a card", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
      },
    },
  });

  await importText(`2x query 1\nquery 2 ${FaceSeparator} query 1`);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(3, Front, cardDocument2.name, 1, 1);
  await expectCardGridSlotState(3, Back, cardDocument1.name, 1, 1);
  await expectCardbackSlotState(cardDocument5.name, 1, 1);

  const [blob, filename] = await downloadDecklist();

  expect(blob.options).toEqual({ type: "text/plain;charset=utf-8" });
  expect(normaliseString(blob.content[0])).toBe(
    normaliseString(
      `2x ${cardDocument1.name}
            1x ${cardDocument2.name} ${FaceSeparator} ${cardDocument1.name}`
    )
  );
  expect(filename).toBe("decklist.txt");
});
