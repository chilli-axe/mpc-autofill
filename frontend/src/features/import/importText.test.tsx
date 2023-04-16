import { renderWithProviders } from "@/common/test-utils";
import {
  cardDocumentsThreeResults,
  cardDocument1,
  cardDocument2,
  cardDocument3,
  searchResultsOneResult,
} from "@/common/test-constants";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import App from "@/app/app";
import { Card } from "@/common/constants";

const preloadedState = {
  cardDocuments: cardDocumentsThreeResults,
  searchResults: searchResultsOneResult,
  project: {
    members: [],
    cardback: cardDocument2.identifier,
  },
  cardbacks: {
    cardbacks: [cardDocument2.identifier, cardDocument3.identifier],
    status: "idle",
    error: null,
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
  renderWithProviders(<App />, { preloadedState });

  // import a card
  await importText("my search query");

  // a card slot should have been created
  await expectCardSlotToExist(1);
  // cardDocument1 should be selected for the front and have a single search result
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("1 / 1")).toBeInTheDocument());
  // cardDocument2 should be selected from the back and have two search results
  // the card name and the text "1 / 2" should be present in the grid and the common cardback
  expect(screen.getAllByText(cardDocument2.name)).toHaveLength(2); // back
  await waitFor(() => expect(screen.getAllByText("1 / 2")).toHaveLength(2));
});

test("importing multiple instances of one card by text into an empty project", async () => {
  renderWithProviders(<App />, { preloadedState });

  // import two instances of a card
  await importText("2x my search query");

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardSlotToExist(2);
  // cardDocument1 should be selected for the front and have a single search result
  expect(screen.getAllByText(cardDocument1.name)).toHaveLength(2); // back
  await waitFor(() => expect(screen.getAllByText("1 / 1")).toHaveLength(2));
  // cardDocument2 should be selected from the back and have two search results
  // the card name and the text "1 / 2" should be present in the grid and the common cardback
  expect(screen.getAllByText(cardDocument2.name)).toHaveLength(3); // back
  await waitFor(() => expect(screen.getAllByText("1 / 2")).toHaveLength(3));
});

test("importing multiple instances of one card by text into a non-empty project", async () => {
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
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("1 / 1")).toBeInTheDocument());

  // import two instances of a card
  await importText("2x my search query");

  // two card slots should have been created
  await expectCardSlotToExist(2);
  await expectCardSlotToExist(3);
  // cardDocument1 should be selected for each front and have a single search result
  expect(screen.getAllByText(cardDocument1.name)).toHaveLength(3); // back
  await waitFor(() => expect(screen.getAllByText("1 / 1")).toHaveLength(3));
  // cardDocument2 should be selected from the back and have two search results
  // the card name and the text "1 / 2" should be present in the grid and the common cardback
  expect(screen.getAllByText(cardDocument2.name)).toHaveLength(4); // back
  await waitFor(() => expect(screen.getAllByText("1 / 2")).toHaveLength(4));
});
