import { Card, Front } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument5,
} from "@/common/test-constants";
import {
  changeQuery,
  expectCardGridSlotState,
  expectCardSlotToExist,
  renderWithProviders,
} from "@/common/test-utils";
import ProjectEditor from "@/components/ProjectEditor";
import {
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsSixResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

describe("ChangeQueryModal tests", () => {
  test("change one card's query", async () => {
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
  });
});
