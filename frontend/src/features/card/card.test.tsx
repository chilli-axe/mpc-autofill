import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
} from "@/common/test-constants";
import { renderWithProviders } from "@/common/test-utils";
import { Card } from "@/features/card/card";

test("the html structure of a Card with a single document", () => {
  const rendered = renderWithProviders(
    <Card
      cardHeaderTitle="Card 1"
      noResultsFound={false}
      imageIdentifier={cardDocument1.identifier}
    />,
    {
      preloadedState: {
        cardDocuments: {
          cardDocuments: {
            [cardDocument1.identifier]: cardDocument1,
          },
          status: "idle",
          error: null,
        },
      },
    }
  );
  expect(rendered.baseElement).toMatchSnapshot();
});

test("the html structure of a Card with two documents", () => {
  const rendered = renderWithProviders(
    <Card
      cardHeaderTitle="Card 2"
      noResultsFound={false}
      imageIdentifier={cardDocument1.identifier}
      previousImageIdentifier={cardDocument2.identifier}
    />,
    {
      preloadedState: {
        cardDocuments: {
          cardDocuments: {
            [cardDocument1.identifier]: cardDocument1,
            [cardDocument2.identifier]: cardDocument2,
          },
          status: "idle",
          error: null,
        },
      },
    }
  );
  expect(rendered.baseElement).toMatchSnapshot();
});

test("the html structure of a Card with three documents", () => {
  const rendered = renderWithProviders(
    <Card
      cardHeaderTitle="Card 3"
      noResultsFound={false}
      imageIdentifier={cardDocument1.identifier}
      previousImageIdentifier={cardDocument2.identifier}
      nextImageIdentifier={cardDocument3.identifier}
    />,
    {
      preloadedState: {
        cardDocuments: {
          cardDocuments: {
            [cardDocument1.identifier]: cardDocument1,
            [cardDocument2.identifier]: cardDocument2,
            [cardDocument3.identifier]: cardDocument3,
          },
          status: "idle",
          error: null,
        },
      },
    }
  );
  expect(rendered.baseElement).toMatchSnapshot();
});

test("the html structure of a Card with no search results", () => {
  const rendered = renderWithProviders(
    <Card
      imageIdentifier={undefined}
      cardHeaderTitle="Card 1"
      noResultsFound={true}
      searchQuery={{ query: "My Invalid Query", card_type: "CARD" }}
    />,
    {
      preloadedState: {
        cardDocuments: {
          cardDocuments: {},
          status: "idle",
          error: null,
        },
      },
    }
  );
  expect(rendered.baseElement).toMatchSnapshot();
});
