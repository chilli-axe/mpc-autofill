import { screen, waitFor } from "@testing-library/react";

import { Card, Front } from "@/common/constants";
import { cardDocument1 } from "@/common/test-constants";
import {
  expectCardGridSlotState,
  renderWithProviders,
} from "@/common/test-utils";
import ProjectEditor from "@/components/ProjectEditor";
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
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [
          {
            front: {
              query: { query: "my search query", cardType: Card },
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
  await waitFor(() => expect(screen.getByText("English")));

  expect(screen.getByTestId("detailed-view")).toMatchSnapshot();
});

//# endregion
