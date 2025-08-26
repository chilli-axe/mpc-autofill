import { screen, waitFor } from "@testing-library/react";

import { Back, FaceSeparator, Front } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  cardDocument5,
} from "@/common/test-constants";
import {
  changeImageForSelectedImages,
  changeQueryForSelectedImages,
  clearQueriesForSelectedImages,
  clickMoreSelectOptionsDropdown,
  deleteSelectedImages,
  deselectSlot,
  expectCardbackSlotState,
  expectCardGridSlotState,
  expectCardSlotToNotExist,
  importText,
  renderWithProviders,
  selectAll,
  selectSimilar,
  selectSlot,
} from "@/common/test-utils";
import ProjectEditor from "@/components/ProjectEditor";
import {
  cardbacksOneOtherResult,
  cardbacksOneResult,
  cardbacksTwoResults,
  cardDocumentsOneResult,
  cardDocumentsSixResults,
  cardDocumentsThreeResults,
  defaultHandlers,
  dfcPairsMatchingCards1And4,
  searchResultsForDFCMatchedCards1And4,
  searchResultsOneResult,
  searchResultsSixResults,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

test("selecting a single card and changing its query", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("query 1");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await changeQueryForSelectedImages("query 2");
  await expectCardGridSlotState(1, Front, cardDocument2.name, 1, 1);
});

test("selecting multiple cards and changing both of their queries", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("2x query 1");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await selectSlot(2, Front);
  await changeQueryForSelectedImages("query 2");
  await expectCardGridSlotState(1, Front, cardDocument2.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument2.name, 1, 1);
});

test("selecting a single card and changing its selected image", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 3);

  await selectSlot(1, Front);
  await changeImageForSelectedImages(cardDocument2.name);
  await expectCardGridSlotState(1, Front, cardDocument2.name, 2, 3);
});

test("selecting multiple cards with the same query and changing both of their selected images", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("2x my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 3);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 3);

  await selectSlot(1, Front);
  await selectSlot(2, Front);
  await changeImageForSelectedImages(cardDocument2.name);
  await expectCardGridSlotState(1, Front, cardDocument2.name, 2, 3);
  await expectCardGridSlotState(2, Front, cardDocument2.name, 2, 3);
});

test("selecting multiple cardbacks and changing both of their selected images", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument1.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("2x my search query");
  await expectCardGridSlotState(1, Back, cardDocument1.name, 1, 2);
  await expectCardGridSlotState(2, Back, cardDocument1.name, 1, 2);

  await selectSlot(1, Back);
  await selectSlot(2, Back);
  await changeImageForSelectedImages(cardDocument2.name);
  await expectCardGridSlotState(1, Back, cardDocument2.name, 2, 2);
  await expectCardGridSlotState(2, Back, cardDocument2.name, 2, 2);
});

test("cannot change the images of multiple selected images when they don't share the same query", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("query 1\nquery 2");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument2.name, 1, 1);

  await selectSlot(1, Front);
  await selectSlot(2, Front);

  clickMoreSelectOptionsDropdown();
  await waitFor(() =>
    expect(screen.queryByText("Change Version")).not.toBeInTheDocument()
  );
});

test.skip("selecting a single card and clearing its front query", async () => {
  server.use(
    cardDocumentsOneResult,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await clearQueriesForSelectedImages();
  await expectCardGridSlotState(1, Front, null, null, null);
});

test.skip("selecting a single card and clearing its back query", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText(`my search query ${FaceSeparator} my search query`);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument1.name, 1, 1);
  await expectCardbackSlotState(cardDocument5.name, 1, 1);

  await selectSlot(1, Back);
  await clearQueriesForSelectedImages();
  // after its query is cleared, slot 1's back has reverted to the project's cardback
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(1, Back, cardDocument5.name, 1, 1);
});

test.skip("selecting multiple cards and clearing their front queries", async () => {
  server.use(
    cardDocumentsOneResult,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("2x my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await selectSlot(2, Front);
  await clearQueriesForSelectedImages();
  await expectCardGridSlotState(1, Front, null, null, null);
  await expectCardGridSlotState(2, Front, null, null, null);
});

test("selecting a single card and deleting it", async () => {
  server.use(
    cardDocumentsOneResult,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await deleteSelectedImages();
  await expectCardSlotToNotExist(1);
});

test("selecting multiple cards and deleting them", async () => {
  server.use(
    cardDocumentsOneResult,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("2x my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await selectSlot(2, Front);
  await deleteSelectedImages();
  await expectCardSlotToNotExist(1);
  await expectCardSlotToNotExist(2);
});

test("selecting then clearing the selection", async () => {
  server.use(
    cardDocumentsOneResult,
    cardbacksOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await deselectSlot(1, Front);
});

test("selecting then expanding the selection to similar front images", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("2x query 1\n1x query 2");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1, false);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1, false);
  await expectCardGridSlotState(3, Front, cardDocument2.name, 1, 1, false);

  await selectSlot(1, Front);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1, true);
  await selectSimilar();
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1, true);

  // slot 3 should not have been selected
  await expectCardGridSlotState(3, Front, cardDocument2.name, 1, 1, false);
});

test("selecting then expanding the selection to similar back images", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsForDFCMatchedCards1And4,
    dfcPairsMatchingCards1And4,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("1x my search query\n2x card 3");
  // slot 1 uses dfc-pair matching to pair cards 1 and 4, while slots 2 and 3 display card 3 and use the project back
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1, false);
  await expectCardGridSlotState(1, Back, cardDocument4.name, 1, 1, false);
  await expectCardGridSlotState(2, Front, cardDocument3.name, 1, 1, false);
  await expectCardGridSlotState(2, Back, cardDocument5.name, 1, 1, false);
  await expectCardGridSlotState(3, Front, cardDocument3.name, 1, 1, false);
  await expectCardGridSlotState(3, Back, cardDocument5.name, 1, 1, false);

  await selectSlot(2, Back);
  await expectCardGridSlotState(2, Back, cardDocument5.name, 1, 1, true);
  await selectSimilar();
  await expectCardGridSlotState(3, Back, cardDocument5.name, 1, 1, true);

  // slot 1's back should remain unselected
  await expectCardGridSlotState(1, Back, cardDocument4.name, 1, 1, false);
});

test("selecting then expanding the selection to all front images", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneOtherResult,
    sourceDocumentsOneResult,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: {
        members: [],
        cardback: cardDocument5.identifier,
        mostRecentlySelectedSlot: null,
      },
    },
  });

  await importText("2x query 1\n1x query 2");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1, false);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1, false);
  await expectCardGridSlotState(3, Front, cardDocument2.name, 1, 1, false);

  await selectSlot(1, Front);
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1, true);
  await selectAll();
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1, true);
  await expectCardGridSlotState(3, Front, cardDocument2.name, 1, 1, true);
});
