import {
  cardDocument1,
  cardDocument2,
  cardDocument4,
  localBackend,
} from "@/common/test-constants";
import {
  renderWithProviders,
  expectCardSlotToExist,
  expectCardGridSlotState,
  expectCardbackSlotState,
} from "@/common/test-utils";
import {
  cardDocumentsThreeResults,
  cardDocumentsFourResults,
  cardbacksTwoOtherResults,
  sourceDocumentsOneResult,
  searchResultsOneResult,
  dfcPairsMatchingCards1And4,
  searchResultsForDFCMatchedCards1And4,
} from "@/mocks/handlers";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import App from "@/app/app";
import { Card, Front, Back } from "@/common/constants";
import { server } from "@/mocks/server";

const preloadedState = {
  backend: localBackend,
  project: {
    members: [],
    cardback: cardDocument2.identifier,
  },
};

async function openImportTextModal() {
  // open the modal and find the text area
  screen.getByText("Add Cards", { exact: false }).click();
  await waitFor(() => screen.getByText("Text", { exact: false }).click());
  await waitFor(() => expect(screen.getByText("Add Cards — Text")));
  return screen.getByLabelText("import-text");
}

async function importText(text: string) {
  const textArea = await openImportTextModal();
  fireEvent.change(textArea, { target: { value: text } });
  screen.getByLabelText("import-text-submit").click();
}

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
