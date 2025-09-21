import { waitFor } from "@testing-library/dom";
import { screen } from "@testing-library/react";

import { Card, Front, SelectedImageSeparator } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument5,
} from "@/common/test-constants";
import {
  changeQuery,
  expectCardGridSlotState,
  expectCardSlotToExist,
  importText,
  renderWithProviders,
} from "@/common/test-utils";
import ProjectEditor from "@/components/ProjectEditor";
import {
  cardDocumentsOneResult,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsOneResult,
  searchResultsSixResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

describe("InvalidIdentifiersStatus tests", () => {
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
    {
      query: `my search query${SelectedImageSeparator}${cardDocument1.identifier}\n\`my search query${SelectedImageSeparator}garbage\``,
      problematicImageCount: 1,
    },
  ])(
    "invalid identifiers status is displayed appropriately",
    async ({ query, problematicImageCount }) => {
      server.use(
        cardDocumentsOneResult,
        sourceDocumentsOneResult,
        searchResultsOneResult,
        ...defaultHandlers
      );
      renderWithProviders(<ProjectEditor />, {
        preloadedState: {
          project: {
            members: [],
            cardback: cardDocument5.identifier,
            mostRecentlySelectedSlot: null,
          },
        },
      });
      await importText(query);
      await expectCardSlotToExist(1);
      await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
      await waitFor(() =>
        expect(
          screen.queryAllByText("Your project specified", { exact: false })
            .length
        ).toBe(problematicImageCount > 0 ? 1 : 0)
      );
      if (problematicImageCount > 0) {
        expect(
          screen.getByText("Your project specified", { exact: false })
            .textContent
        ).toBe(
          `Your project specified ${problematicImageCount} card version${
            problematicImageCount != 1 ? "s" : ""
          } which couldn't be found.`
        );
      }
    }
  );
  test("invalid identifiers status is not displayed when changing query", async () => {
    server.use(
      cardDocumentsThreeResults,
      sourceDocumentsOneResult,
      searchResultsSixResults,
      ...defaultHandlers
    );
    renderWithProviders(<ProjectEditor />, {
      preloadedState: {
        project: {
          members: [
            {
              front: {
                query: { query: "query 1", cardType: Card },
                selectedImage: cardDocument1.identifier,
                selected: false,
              },
              back: null,
            },
          ],
          cardback: cardDocument5.identifier,
          mostRecentlySelectedSlot: null,
        },
      },
    });
    await expectCardSlotToExist(1);
    await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
    // change query - type in "query 2"
    await changeQuery("front-slot0", cardDocument1.name, "query 2");
    // expect the slot to have changed from card 1 to card 2
    await expectCardGridSlotState(1, Front, cardDocument2.name, 1, 1);

    // expect the invalid card warning to *not* have been raised
    await waitFor(() =>
      expect(
        screen.queryAllByText("Your project specified", { exact: false }).length
      ).toBe(0)
    );
  });
});
