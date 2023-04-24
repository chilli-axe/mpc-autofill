import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  cardDocument5,
  cardDocument6,
  localBackend,
} from "@/common/test-constants";
import {
  renderWithProviders,
  expectCardSlotToExist,
  expectCardSlotToNotExist,
  expectCardGridSlotState,
  expectCardbackSlotState,
  openImportTextModal,
  importText,
} from "@/common/test-utils";
import {
  cardDocumentsThreeResults,
  cardDocumentsFourResults,
  cardbacksTwoOtherResults,
  sourceDocumentsOneResult,
  searchResultsOneResult,
  dfcPairsMatchingCards1And4,
  searchResultsForDFCMatchedCards1And4,
  sampleCards,
} from "@/mocks/handlers";
import { screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import App from "@/app/app";
import { Card, Front, Back } from "@/common/constants";
import { server } from "@/mocks/server";

//# region mocks
// this ensures that the text import placeholder text is deterministic between test runs

beforeEach(() => {
  jest.spyOn(global.Math, "random").mockReturnValue(1);
});

afterEach(() => {
  jest.spyOn(global.Math, "random").mockRestore();
});

//# endregion

const preloadedState = {
  backend: localBackend,
  project: {
    members: [],
    cardback: cardDocument2.identifier,
  },
};

//# region snapshot tests

test("the html structure of text importer", async () => {
  renderWithProviders(<App />, { preloadedState });

  await openImportTextModal();

  expect(screen.getByTestId("import-text")).toMatchSnapshot();
});

//# endregion

test("importing one card by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, { preloadedState });

  // import a card
  await importText("my search query");

  // a card slot should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing multiple instances of one card by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, { preloadedState });

  // import two instances of a card
  await importText("2x my search query");

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing multiple instances of one card without an x by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, { preloadedState });

  // import two instances of a card without an x
  await importText("2 my search query");

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing multiple instances of one card with a capital X by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, { preloadedState });

  // import two instances of a card with a capital X
  await importText("2X my search query");

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing multiple instances of one card by text into a non-empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, {
    preloadedState: {
      ...preloadedState,
      project: {
        members: [
          {
            front: {
              query: { query: "my search query", card_type: Card },
              selectedImage: cardDocument1.identifier,
            },
            back: null,
          },
        ],
        cardback: cardDocument2.identifier,
      },
    },
  });

  // this slot should already exist from our preloaded state
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import two instances of a card
  await importText("2x my search query");

  // two card slots should have been created
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(3);
  await expectCardGridSlotState(3, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(3, Back, cardDocument2.name, 1, 2);
});

test("importing one DFC-paired card by text into an empty project", async () => {
  server.use(
    cardDocumentsFourResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsForDFCMatchedCards1And4,
    dfcPairsMatchingCards1And4
  );
  renderWithProviders(<App />, { preloadedState });

  // import one instance of a double faced card
  await importText("my search query");

  // we should now have both sides of that DFC pair in slot 1
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument4.name, 1, 1);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing an empty string by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, { preloadedState });

  await importText("");

  await expectCardSlotToNotExist(1);
});

test("the placeholder text of the text importer", async () => {
  server.use(sampleCards);
  renderWithProviders(<App />, { preloadedState });

  await openImportTextModal();

  const myman = within(screen.getByTestId("import-text")).getByRole("textbox");

  // TODO: assert on the placeholder text of the text area
  await waitFor(() =>
    expect(
      within(screen.getByTestId("import-text")).getByRole("textbox")
    ).toHaveAttribute(
      "placeholder",
      `4x ${cardDocument1.name}
4x ${cardDocument2.name}
4x ${cardDocument3.name}
4x ${cardDocument4.name}

4x t:${cardDocument6.name}

4x b:${cardDocument5.name}`
    )
  );
});
