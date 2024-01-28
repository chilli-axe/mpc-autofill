import { screen, waitFor } from "@testing-library/react";

import App from "@/app/app";
import { Card, Front } from "@/common/constants";
import { cardDocument1 } from "@/common/test-constants";
import {
  expectCardGridSlotState,
  renderWithProviders,
} from "@/common/test-utils";
import {
  cardDocumentsOneResult,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

//# region snapshot tests

test("the html structure of a CardDetailedViewModal", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      project: {
        members: [
          {
            front: {
              query: { query: "my search query", card_type: Card },
              selectedImage: cardDocument1.identifier,
              selected: false,
            },
            back: null,
          },
        ],
        cardback: null,
        mostRecentlySelectedSlot: null,
      },
    },
  });
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);

  screen.getByAltText(cardDocument1.name).click();
  await waitFor(() => expect(screen.getByText("Card Details")));

  expect(screen.getByTestId("detailed-view")).toMatchSnapshot();
});

//# endregion
