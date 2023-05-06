import { screen } from "@testing-library/react";

import App from "@/app/app";
import { cardDocument1, localBackend } from "@/common/test-constants";
import {
  expectCardbackSlotState,
  renderWithProviders,
} from "@/common/test-utils";
import {
  cardbacksOneResult,
  cardbacksTwoResults,
  cardDocumentsOneResult,
  defaultHandlers,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

//# region snapshot tests

test("the html structure of a CommonCardback with a single search result", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    cardbacksOneResult,
    ...defaultHandlers
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
    cardbacksTwoResults,
    ...defaultHandlers
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
