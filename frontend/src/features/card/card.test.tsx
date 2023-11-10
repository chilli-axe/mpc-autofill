import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
} from "@/common/test-constants";
import { renderWithProviders } from "@/common/test-utils";
import { MemoizedEditorCard } from "@/features/card/card";

test("the html structure of a Card with a single document", () => {
  const rendered = renderWithProviders(
    <MemoizedEditorCard
      cardHeaderTitle="Slot 1"
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
  expect(
    rendered.getByText("Slot 1").parentElement!.parentElement!
  ).toMatchSnapshot();
});

test("the html structure of a Card with two documents", () => {
  const rendered = renderWithProviders(
    <MemoizedEditorCard
      cardHeaderTitle="Slot 2"
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
  expect(
    rendered.getByText("Slot 2").parentElement!.parentElement!
  ).toMatchSnapshot();
});

test("the html structure of a Card with three documents", () => {
  const rendered = renderWithProviders(
    <MemoizedEditorCard
      cardHeaderTitle="Slot 3"
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
  expect(
    rendered.getByText("Slot 3").parentElement!.parentElement!
  ).toMatchSnapshot();
});

test("the html structure of a Card with no search results", () => {
  const rendered = renderWithProviders(
    <MemoizedEditorCard
      imageIdentifier={undefined}
      cardHeaderTitle="Slot 1"
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
  expect(
    rendered.getByText("Slot 1").parentElement!.parentElement!
  ).toMatchSnapshot();
});
