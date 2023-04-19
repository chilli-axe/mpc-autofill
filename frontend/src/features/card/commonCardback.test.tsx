import { server } from "@/mocks/server";
import {
  cardDocumentsOneResult,
  cardbacksOneResult,
  sourceDocumentsOneResult,
  cardbacksTwoResults,
} from "@/mocks/handlers";
import {
  expectCardbackSlotState,
  renderWithProviders,
} from "@/common/test-utils";
import App from "@/app/app";
import { cardDocument1, localBackend } from "@/common/test-constants";
import { screen } from "@testing-library/react";

//# region snapshot tests

test("the html structure of a CommonCardback with a single search result", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    cardbacksOneResult
  );

  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: { members: [], cardback: null },
    },
  });

  await expectCardbackSlotState(cardDocument1.name, 1, 1);
  expect(screen.getByTestId("common-cardback")).toMatchSnapshot();
});

test("the html structure of a CommonCardback with multiple search results", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    cardbacksTwoResults
  );

  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: { members: [], cardback: null },
    },
  });

  await expectCardbackSlotState(cardDocument1.name, 1, 2);
  expect(screen.getByTestId("common-cardback")).toMatchSnapshot();
});

//# endregion
