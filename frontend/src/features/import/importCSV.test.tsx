import { screen } from "@testing-library/react";

import App from "@/app/app";
import { Back, Front } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  localBackend,
} from "@/common/test-constants";
import {
  expectCardbackSlotState,
  expectCardGridSlotState,
  expectCardSlotToExist,
  importCSV,
  openImportCSVModal,
  renderWithProviders,
} from "@/common/test-utils";
import {
  cardbacksTwoOtherResults,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

const preloadedState = {
  backend: localBackend,
  project: {
    members: [],
    cardback: cardDocument2.identifier,
  },
};

//# region snapshot tests

test("the html structure of CSV importer", async () => {
  renderWithProviders(<App />, { preloadedState });

  await openImportCSVModal();

  expect(screen.getByTestId("import-csv")).toMatchSnapshot();
});

//# endregion

test("importing one card by CSV into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, { preloadedState });

  // import a card
  await importCSV("Quantity,Front\n,my search query");

  // a card slot should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});
