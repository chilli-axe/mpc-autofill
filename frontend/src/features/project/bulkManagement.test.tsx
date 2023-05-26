import { screen, waitFor } from "@testing-library/react";

import App from "@/app/app";
import { Front } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument5,
  localBackend,
} from "@/common/test-constants";
import {
  changeImageForSelectedImages,
  changeQueryForSelectedImages,
  deleteSelectedImages,
  deselectSlot,
  expectCardGridSlotState,
  expectCardSlotToNotExist,
  importText,
  renderWithProviders,
  selectSlot,
} from "@/common/test-utils";
import {
  cardbacksOneResult,
  cardDocumentsOneResult,
  cardDocumentsSixResults,
  cardDocumentsThreeResults,
  defaultHandlers,
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
    cardbacksOneResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [],
        cardback: cardDocument5.identifier,
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
    cardbacksOneResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [],
        cardback: cardDocument5.identifier,
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
    cardbacksOneResult,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [],
        cardback: cardDocument5.identifier,
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
    cardbacksOneResult,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [],
        cardback: cardDocument5.identifier,
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

test("cannot change the images of multiple selected images when they don't share the same query", async () => {
  server.use(
    cardDocumentsSixResults,
    cardbacksOneResult,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [],
        cardback: cardDocument5.identifier,
      },
    },
  });

  await importText("query 1\nquery 2");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument2.name, 1, 1);

  await selectSlot(1, Front);
  await selectSlot(2, Front);

  screen.getByText("Modify").click();
  await waitFor(() =>
    expect(screen.queryByText("Change Version")).not.toBeInTheDocument()
  );
});

test("selecting a single card and deleting it", async () => {
  server.use(
    cardDocumentsOneResult,
    cardbacksOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [],
        cardback: cardDocument5.identifier,
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
    cardbacksOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [],
        cardback: cardDocument5.identifier,
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
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [],
        cardback: cardDocument5.identifier,
      },
    },
  });

  await importText("my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await deselectSlot(1, Front);
});
