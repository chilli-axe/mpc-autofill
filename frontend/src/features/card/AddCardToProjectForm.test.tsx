import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  searchResultsOneResultCorrectSearchq,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

describe("AddCardToProjectForm tests", () => {
  test.each([{ quantity: 1 }, { quantity: 2 }, { quantity: 3 }])(
    "adding card to project through detailed view",
    async ({ quantity }) => {
      server.use(
        cardDocumentsOneResult,
        sourceDocumentsOneResult,
        searchResultsOneResultCorrectSearchq,
        ...defaultHandlers
      );
      renderWithProviders(<ProjectEditor />, {
        preloadedState: {
          project: {
            members: [
              {
                front: {
                  query: { query: "card 1", cardType: Card },
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
      await waitFor(() =>
        expect(screen.getByText("Card Details")).toBeInTheDocument()
      );

      const quantityInput = screen.getByAltText(
        "Quantity of card to add to project"
      );
      const user = userEvent.setup();
      await user.clear(quantityInput);
      await user.type(quantityInput, quantity.toString());
      screen.getByText("Add to Project", { exact: false }).click();

      screen.getByLabelText("Close").click();

      for (const slot of Array(quantity).keys()) {
        await expectCardGridSlotState(
          slot + 2,
          Front,
          cardDocument1.name,
          1,
          1
        );
      }
    }
  );
});
