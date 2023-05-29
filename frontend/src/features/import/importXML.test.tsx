import { screen } from "@testing-library/react";

import App from "@/app/app";
import { Back, Card, Front } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  cardDocument5,
  cardDocument6,
  localBackend,
} from "@/common/test-constants";
import {
  expectCardbackSlotState,
  expectCardGridSlotState,
  expectCardSlotToExist,
  importXML,
  openImportXMLModal,
  renderWithProviders,
} from "@/common/test-utils";
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
  backend: localBackend,
  project: {
    members: [],
    cardback: cardDocument2.identifier,
  },
};

//# region snapshot tests

test("the html structure of XML importer", async () => {
  renderWithProviders(<App />, { preloadedState });

  await openImportXMLModal();

  expect(screen.getByTestId("import-xml")).toMatchSnapshot();
});

//# endregion

test("importing one card by XML into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a card
  await importXML(
    `<order>
      <details>
        <quantity>1</quantity>
        <bracket>18</bracket>
      </details>
      <fronts>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>0</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <cardback>${cardDocument3.identifier}</cardback>
    </order>`
  );

  // a card slot should have been created and it should retain the xml's cardback, not the project cardback
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument3.name, 2, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing multiple instances of one card by XML into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import two instances of a card
  await importXML(
    `<order>
      <details>
        <quantity>2</quantity>
        <bracket>18</bracket>
      </details>
      <fronts>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <cardback>${cardDocument2.identifier}</cardback>
    </order>`
  );

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing one specific card version by XML into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a card
  await importXML(
    `<order>
      <details>
        <quantity>1</quantity>
        <bracket>18</bracket>
      </details>
      <fronts>
        <card>
          <id>${cardDocument3.identifier}</id>
          <slots>0</slots>
          <name>${cardDocument3.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <cardback>${cardDocument2.identifier}</cardback>
    </order>`
  );

  // a card slot should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument3.name, 3, 3);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing one card of each type into an empty project", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksTwoOtherResults,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import one card of each type
  await importXML(
    `<order>
      <details>
        <quantity>3</quantity>
        <bracket>18</bracket>
      </details>
      <fronts>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>0</slots>
          <name>${cardDocument1.name}</name>
          <query>query 1</query>
        </card>
        <card>
          <id>${cardDocument6.identifier}</id>
          <slots>1</slots>
          <name>${cardDocument6.name}</name>
          <query>t:query 6</query>
        </card>
        <card>
          <id>${cardDocument5.identifier}</id>
          <slots>2</slots>
          <name>${cardDocument5.name}</name>
          <query>b:query 5</query>
        </card>
      </fronts>
      <cardback>${cardDocument3.identifier}</cardback>
    </order>`
  );

  // three card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument3.name, 2, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument6.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument3.name, 2, 2);
  await expectCardSlotToExist(3);
  await expectCardGridSlotState(3, Front, cardDocument5.name, 1, 1);
  await expectCardGridSlotState(3, Back, cardDocument3.name, 2, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing a more complex XML into an empty project", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsFourResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a few cards
  await importXML(
    `<order>
      <details>
        <quantity>3</quantity>
        <bracket>18</bracket>
      </details>
      <fronts>
        <card>
          <id>${cardDocument3.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument3.name}</name>
          <query>my search query</query>
        </card>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>2</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <backs>
        <card>
          <id>${cardDocument4.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument4.name}</name>
          <query>my search query</query>
        </card>
      </backs>
      <cardback>${cardDocument2.identifier}</cardback>
    </order>`
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
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing an XML with gaps into an empty project", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsFourResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a few cards
  await importXML(
    `<order>
      <details>
        <quantity>4</quantity>
        <bracket>18</bracket>
      </details>
      <fronts>
        <card>
          <id>${cardDocument3.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument3.name}</name>
          <query>my search query</query>
        </card>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>3</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <backs>
        <card>
          <id>${cardDocument4.identifier}</id>
          <slots>0,3</slots>
          <name>${cardDocument4.name}</name>
          <query>my search query</query>
        </card>
      </backs>
      <cardback>${cardDocument2.identifier}</cardback>
    </order>`
  );

  // four card slots should have been created, but only three will have images selected
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument3.name, 3, 4);
  await expectCardGridSlotState(1, Back, cardDocument4.name, 4, 4);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument3.name, 3, 4);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(4);
  await expectCardSlotToExist(3);
  await expectCardGridSlotState(4, Front, cardDocument1.name, 1, 4);
  await expectCardGridSlotState(4, Back, cardDocument4.name, 4, 4);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing a more complex XML into a non-empty project", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsFourResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      ...preloadedState,
      project: {
        members: [
          {
            front: {
              query: { query: "my search query", card_type: Card },
              selectedImage: cardDocument1.identifier,
            },
            back: null,
          },
        ],
        cardback: cardDocument2.identifier,
      },
    },
  });

  // this slot should already exist from our preloaded state
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 4);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a few more cards
  await importXML(
    `<order>
      <details>
        <quantity>3</quantity>
        <bracket>18</bracket>
      </details>
      <fronts>
        <card>
          <id>${cardDocument3.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument3.name}</name>
          <query>my search query</query>
        </card>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>2</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <backs>
        <card>
          <id>${cardDocument4.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument4.name}</name>
          <query>my search query</query>
        </card>
      </backs>
      <cardback>${cardDocument3.identifier}</cardback>
    </order>`
  );

  // three card slots should have been created
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument3.name, 3, 4);
  await expectCardGridSlotState(2, Back, cardDocument4.name, 4, 4);
  await expectCardSlotToExist(3);
  await expectCardGridSlotState(3, Front, cardDocument3.name, 3, 4);
  await expectCardGridSlotState(3, Back, cardDocument4.name, 4, 4);
  await expectCardSlotToExist(4);
  await expectCardGridSlotState(4, Front, cardDocument1.name, 1, 4);
  await expectCardGridSlotState(4, Back, cardDocument3.name, 2, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("import an XML and retain its cardback", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a card
  await importXML(
    `<order>
      <details>
        <quantity>1</quantity>
        <bracket>18</bracket>
      </details>
      <fronts>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>0</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <cardback>${cardDocument3.identifier}</cardback>
    </order>`,
    true
  );

  // a card slot should have been created and it should retain the xml's cardback, not the project cardback
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument3.name, 2, 2);
  // the project cardback should also have been updated
  await expectCardbackSlotState(cardDocument3.name, 2, 2);
});
