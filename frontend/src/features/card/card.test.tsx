import { renderWithProviders } from "@/common/test-utils";
import { Card } from "@/features/card/card";
import { screen, render } from "@testing-library/react";
import { CardDocument } from "@/common/types";

const cardDocument1: CardDocument = {
  identifier: "abc123",
  card_type: "CARD",
  name: "Card 1",
  priority: 0,
  source: "Card Source",
  source_id: 0,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 1",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

const cardDocument2: CardDocument = {
  identifier: "abc1234",
  card_type: "CARD",
  name: "Card 2",
  priority: 0,
  source: "Card Source",
  source_id: 0,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 2",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

const cardDocument3: CardDocument = {
  identifier: "abc12345",
  card_type: "CARD",
  name: "Card 3",
  priority: 0,
  source: "Card Source",
  source_id: 0,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 3",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

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
