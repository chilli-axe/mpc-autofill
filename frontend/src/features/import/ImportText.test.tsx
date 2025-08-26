import { within } from "@testing-library/dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Back, Front, SelectedImageSeparator } from "@/common/constants";
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
  expectCardSlotToNotExist,
  importText,
  openImportTextModal,
  renderWithProviders,
} from "@/common/test-utils";
import ProjectEditor from "@/components/ProjectEditor";
import {
  cardbacksTwoOtherResults,
  cardDocumentsFourResults,
  cardDocumentsSixResults,
  cardDocumentsThreeResults,
  defaultHandlers,
  dfcPairsMatchingCards1And4,
  sampleCards,
  searchResultsForDFCMatchedCards1And4,
  searchResultsOneResult,
  searchResultsSixResults,
  sourceDocumentsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

//# region mocks
// this ensures that the text import placeholder text is deterministic between test runs

beforeEach(() => {
  jest.spyOn(global.Math, "random").mockReturnValue(1);
});

afterEach(() => {
  jest.spyOn(global.Math, "random").mockRestore();
});

//# endregion

const preloadedState = {
  project: {
    members: [],
    cardback: cardDocument2.identifier,
    mostRecentlySelectedSlot: null,
  },
};

//# region snapshot tests

test("the html structure of text importer", async () => {
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await openImportTextModal();

  expect(screen.getByTestId("import-text")).toMatchSnapshot();
});

//# endregion

test("importing one card by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a card
  await importText("my search query");

  // a card slot should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing multiple instances of one card by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import two instances of a card
  await importText("2x my search query");

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing multiple instances of one card without an x by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  // import two instances of a card without an x
  await importText("2 my search query");

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);
});

test("importing multiple instances of one card with a capital X by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import two instances of a card with a capital X
  await importText("2X my search query");

  // two card slots should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing multiple instances of one card by text into a non-empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      ...preloadedState,
      project: {
        members: [],
        cardback: cardDocument2.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  // this used to preload the redux state, but with the shift to listeners,
  // we have to add the first card manually like this.
  await importText(
    `1x my search query${SelectedImageSeparator}${cardDocument1.identifier}`
  );
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import two instances of a card
  await importText("2x my search query");

  // two card slots should have been created
  await expectCardSlotToExist(2);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 1, 2);
  await expectCardSlotToExist(3);
  await expectCardGridSlotState(3, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(3, Back, cardDocument2.name, 1, 2);
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

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import one card of each type
  await importText("query 1\nt:query 6\nb:query 5");

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
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing one DFC-paired card by text into an empty project", async () => {
  server.use(
    cardDocumentsFourResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsForDFCMatchedCards1And4,
    dfcPairsMatchingCards1And4,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import one instance of a double faced card
  await importText("my search query");

  // we should now have both sides of that DFC pair in slot 1
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument4.name, 1, 1);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});

test("importing an empty string by text into an empty project", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await importText("");

  await expectCardSlotToNotExist(1);
});

test("the placeholder text of the text importer", async () => {
  server.use(sampleCards, ...defaultHandlers);
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await openImportTextModal();
  await waitFor(() =>
    expect(
      within(screen.getByTestId("import-text")).getByRole("textbox")
    ).toHaveAttribute(
      "placeholder",
      `4x ${cardDocument1.name}
4x ${cardDocument2.name}
4x ${cardDocument3.name}
4x ${cardDocument4.name}

4x t:${cardDocument6.name}

4x b:${cardDocument5.name}`
    )
  );
});

test("the textbox should clear itself after submitting a list", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a card
  await importText("my search query");

  // a card slot should have been created
  await expectCardSlotToExist(1);

  // open the window again and assert that the textbox is empty
  const textArea = await openImportTextModal();
  expect(textArea.textContent).toEqual("");
});

test("the textbox should not clear itself until the form has been submitted", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // open the window and set some text
  const textArea = await openImportTextModal();
  const user = userEvent.setup();
  await user.clear(textArea);
  await user.type(textArea, "big test");

  // close the window and reopen it
  screen.getByLabelText("import-text-close").click();
  const textArea2 = await openImportTextModal();
  expect(textArea2.textContent).toEqual("big test");
});

test("pressing ctrl+enter while focused on the textarea should submit the form", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoOtherResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, { preloadedState });

  await expectCardbackSlotState(cardDocument2.name, 1, 2);

  // import a card
  const textArea = await openImportTextModal();
  const user = userEvent.setup();
  await user.clear(textArea);
  await user.type(textArea, "my search query");
  await user.keyboard("{Control>}{Enter}");

  // a card slot should have been created
  await expectCardSlotToExist(1);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 1, 2);
  await expectCardbackSlotState(cardDocument2.name, 1, 2); // should not have changed
});
