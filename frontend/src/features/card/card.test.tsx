import { renderWithProviders } from "@/common/test-utils";
import { Card } from "@/features/card/card";
import { screen, render } from "@testing-library/react";

test("the html structure of a Card with a single identifier", () => {
  const rendered = renderWithProviders(
    <Card
      cardHeaderTitle="Card 1"
      noResultsFound={false}
      imageIdentifier="abc123"
    />,
    {
      preloadedState: {
        cardDocuments: {
          cardDocuments: {
            abc123: {
              identifier: "abc123",
              card_type: "CARD",
              name: "Card Name",
              priority: 0,
              source: "Card Source",
              source_id: 0,
              source_verbose: "Card Source",
              source_type: "google drive",
              dpi: 1200,
              searchq: "card name",
              extension: "png",
              date: "1st January, 2000", // formatted by backend
              download_link: "",
              size: 10_000_000,
              small_thumbnail_url: "",
              medium_thumbnail_url: "",
            },
          },
          status: "idle",
          error: null,
        },
      },
    }
  );
  expect(rendered.baseElement).toMatchSnapshot();
});
