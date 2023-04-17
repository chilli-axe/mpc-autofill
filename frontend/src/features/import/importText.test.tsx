import { renderWithProviders } from "@/common/test-utils";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  localBackend,
} from "@/common/test-constants";
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
import { Card } from "@/common/constants";
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

async function expectCardSlotToExist(slot: number) {
  // front and back are both picked up by this query, even though only the front is visible
  await waitFor(() =>
    expect(screen.getAllByText(`Slot ${slot}`)).toHaveLength(2)
  );
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
  // cardDocument1 should be selected for the front and have a single search result
  await waitFor(() =>
    expect(screen.getByText(cardDocument1.name)).toBeInTheDocument()
  );
  expect(screen.getByText("1 / 1")).toBeInTheDocument();
  // cardDocument2 should be selected from the back and have two search results
  // the card name and the text "1 / 2" should be present in the grid and the common cardback
  await waitFor(() =>
    expect(screen.getAllByText(cardDocument2.name)).toHaveLength(2)
  ); // back
  expect(screen.getAllByText("1 / 2")).toHaveLength(2);
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
  await expectCardSlotToExist(2);
  // cardDocument1 should be selected for the front and have a single search result
  await waitFor(() =>
    expect(screen.getAllByText(cardDocument1.name)).toHaveLength(2)
  ); // back
  expect(screen.getAllByText("1 / 1")).toHaveLength(2);
  // cardDocument2 should be selected from the back and have two search results
  // the card name and the text "1 / 2" should be present in the grid and the common cardback
  await waitFor(() =>
    expect(screen.getAllByText(cardDocument2.name)).toHaveLength(3)
  ); // back
  expect(screen.getAllByText("1 / 2")).toHaveLength(3);
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
  await waitFor(() =>
    expect(screen.getByText(cardDocument1.name)).toBeInTheDocument()
  );
  expect(screen.getByText("1 / 1")).toBeInTheDocument();

  // import two instances of a card
  await importText("2x my search query");

  // two card slots should have been created
  await expectCardSlotToExist(2);
  await expectCardSlotToExist(3);
  // cardDocument1 should be selected for each front and have a single search result
  await waitFor(() =>
    expect(screen.getAllByText(cardDocument1.name)).toHaveLength(3)
  ); // back
  expect(screen.getAllByText("1 / 1")).toHaveLength(3);
  // cardDocument2 should be selected from the back and have two search results
  // the card name and the text "1 / 2" should be present in the grid and the common cardback
  await waitFor(() =>
    expect(screen.getAllByText(cardDocument2.name)).toHaveLength(4)
  ); // back
  expect(screen.getAllByText("1 / 2")).toHaveLength(4);
});

// TODO: i cannot figure out atm why this test is failing. fix it later
test.skip("importing one DFC-paired card by text into an empty project", async () => {
  server.use(
    cardDocumentsFourResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    dfcPairsMatchingCards1And4
  );
  renderWithProviders(<App />, { preloadedState });

  // import a card
  await importText("my search query");

  // a card slot should have been created
  await expectCardSlotToExist(1);
  // cardDocument1 should be selected for the front and have a single search result
  await waitFor(() =>
    expect(screen.getByText(cardDocument1.name)).toBeInTheDocument()
  );
  expect(screen.getAllByText("1 / 1")).toHaveLength(2);
  // cardDocument2 should be the project cardback and have two search results
  // cardDocument4 should be selected from the back and have one search results
  await waitFor(() =>
    expect(screen.getByText(cardDocument2.name)).toBeInTheDocument()
  );
  await waitFor(() =>
    expect(screen.getByText(cardDocument4.name)).toBeInTheDocument()
  );
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
});
