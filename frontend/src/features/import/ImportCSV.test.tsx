import { screen } from "@testing-library/react";

import { Back, Front } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  cardDocument5,
  cardDocument6,
} from "@/common/test-constants";
import {
  expectCardbackSlotState,
  expectCardGridSlotState,
  expectCardSlotToExist,
  importCSV,
  openImportCSVModal,
  renderWithProviders,
} from "@/common/test-utils";
import ProjectEditor from "@/components/ProjectEditor";
import {
  cardbacksTwoOtherResults,
  cardDocumentsSixResults,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsFourResults,
  searchResultsOneResult,
  searchResultsSixResults,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

const preloadedState = {
  project: {
    members: [],
    cardback: cardDocument2.identifier,
    mostRecentlySelectedSlot: null,
  },
};

//# region snapshot tests

test("the html structure of CSV importer", async () => {
  renderWithProviders(<ProjectEditor />, { preloadedState });

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
  renderWithProviders(<ProjectEditor />, { preloadedState });

  // import a card
  await importCSV(
    `Quantity,Front
    ,my search query`
  );

  // a card slot should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing multiple instances of one card by CSV into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  // import two instances of a card
  await importCSV(
    `Quantity,Front
    2,my search query`
  );

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing one specific card version by CSV into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  // import a card
  await importCSV(
    `Quantity,Front,Front ID
    ,my search query,${cardDocument3.identifier}`
  );

  // a card slot should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument3.name, 3, 3);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing one card of each type into an empty project", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksTwoOtherResults,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  // import one card of each type
  await importCSV(
    `Quantity,Front
    ,query 1\n,t:query 6\n,b:query 5`
  );

  // three card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument6.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(3);
  await expectCardGridSlotState(3, Front, cardDocument5.name, 1, 1);
  await expectCardGridSlotState(3, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing a more complex CSV into an empty project", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsFourResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  // import a few cards
  await importCSV(
    `Quantity,Front,Front ID,Back,Back ID
    2,my search query,${cardDocument3.identifier},my search query,${cardDocument4.identifier}
    ,my search query`
  );

  // three card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument3.name, 3, 4);
  await expectCardGridSlotState(1, Back, cardDocument4.name, 4, 4);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument3.name, 3, 4);
  await expectCardGridSlotState(2, Back, cardDocument4.name, 4, 4);
  await expectCardSlotToExist(3);
  await expectCardGridSlotState(3, Front, cardDocument1.name, 1, 4);
  await expectCardGridSlotState(3, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("CSV header has spaces", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  // import a card
  await importCSV(
    `Quantity, Front , Front ID
    ,my search query,${cardDocument3.identifier}`
  );

  // a card slot should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument3.name, 3, 3);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});
