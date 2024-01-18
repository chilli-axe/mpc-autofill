import { waitFor } from "@testing-library/dom";
import { screen } from "@testing-library/react";

import App from "@/app/app";
import { Front, SelectedImageSeparator } from "@/common/constants";
import { cardDocument1, cardDocument5 } from "@/common/test-constants";
import {
  expectCardGridSlotState,
  expectCardSlotToExist,
  importText,
  renderWithProviders,
} from "@/common/test-utils";
import {
  cardDocumentsOneResult,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

test.each([
  {
    query: `my search query${SelectedImageSeparator}${cardDocument1.identifier}`,
    problematicImageCount: 0,
  },
  {
    query: `my search query${SelectedImageSeparator}garbage`,
    problematicImageCount: 1,
  },
  {
    query: `2 my search query${SelectedImageSeparator}garbage`,
    problematicImageCount: 2,
  },
])(
  "invalidIdentifiersStatus is displayed appropriately",
  async ({ query, problematicImageCount }) => {
    server.use(
      cardDocumentsOneResult,
      sourceDocumentsOneResult,
      searchResultsOneResult,
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
    await importText(query);
    await expectCardSlotToExist(1);
    await expectCardGridSlotState(
      1,
      Front,
      problematicImageCount > 0 ? "Your search query" : cardDocument1.name,
      1,
      1
    );
    await waitFor(() =>
      expect(
        screen.queryAllByText("Your project specified", { exact: false }).length
      ).toBe(problematicImageCount > 0 ? 1 : 0)
    );
    if (problematicImageCount > 0) {
      expect(
        screen.getByText("Your project specified", { exact: false }).textContent
      ).toBe(
        `Your project specified ${problematicImageCount} card version${
          problematicImageCount != 1 ? "s" : ""
        } which couldn't be found.`
      );
    }
  }
);
