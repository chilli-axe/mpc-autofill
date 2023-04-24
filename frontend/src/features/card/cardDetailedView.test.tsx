import { cardDocument1, localBackend } from "@/common/test-constants";
import {
  expectCardGridSlotState,
  renderWithProviders,
} from "@/common/test-utils";
import {
  cardDocumentsOneResult,
  searchResultsOneResult,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { screen, waitFor } from "@testing-library/react";
import App from "@/app/app";
import { Card, Front } from "@/common/constants";
import { server } from "@/mocks/server";

//# region snapshot tests

test("the html structure of a CardDetailedView", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
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
        cardback: null,
      },
    },
  });
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);

  screen.getByAltText(cardDocument1.name).click();
  await waitFor(() => expect(screen.getByText("Card Details")));

  expect(screen.getByTestId("detailed-view")).toMatchSnapshot();
});

//# endregion
