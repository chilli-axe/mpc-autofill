import { fireEvent, screen, waitFor } from "@testing-library/react";

import App from "@/app/app";
import { Back, Card, Front } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  localBackend,
  projectSelectedImage1,
  projectSelectedImage2,
  projectThreeMembersSelectedImage1,
} from "@/common/test-constants";
import {
  expectCardbackSlotState,
  expectCardGridSlotState,
  expectCardSlotToNotExist,
  openCardSlotGridSelector,
  renderWithProviders,
  selectSlot,
} from "@/common/test-utils";
import {
  cardbacksTwoResults,
  cardDocumentsFourResults,
  cardDocumentsOneResult,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsFourResults,
  searchResultsOneResult,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

//# region snapshot tests

test("the html structure of a CardSlot with a single search result, no image selected", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [
          {
            front: {
              query: { query: "my search query", card_type: Card },
              selectedImage: null,
            },
            back: null,
          },
        ],
        cardback: null,
      },
    },
  });
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  expect(screen.getByTestId("front-slot0")).toMatchSnapshot();
});

test("the html structure of a CardSlot with a single search result, slot selected", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [
          {
            front: {
              query: { query: "my search query", card_type: Card },
              selectedImage: null,
            },
            back: null,
          },
        ],
        cardback: null,
      },
    },
  });
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  screen.getByLabelText("select-front0").click();
  await waitFor(() =>
    expect(screen.getByLabelText("select-front0").firstChild).toHaveClass(
      "bi-check-square"
    )
  );
  expect(screen.getByTestId("front-slot0")).toMatchSnapshot();
});

test("the html structure of a CardSlot with a single search result, image selected", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );

  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage1,
    },
  });

  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  expect(screen.getByTestId("front-slot0")).toMatchSnapshot();
});

test("the html structure of a CardSlot with multiple search results, image selected", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults
  );

  renderWithProviders(<App />, {
    preloadedState: { backend: localBackend, project: projectSelectedImage1 },
  });

  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 3);
  expect(screen.getByTestId("front-slot0")).toMatchSnapshot();
});

test("the html structure of a CardSlot's grid selector, cards faceted by source", async () => {
  server.use(
    cardDocumentsFourResults,
    sourceDocumentsThreeResults,
    searchResultsFourResults
  );

  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage1,
    },
  });

  const gridSelector = await openCardSlotGridSelector(1, Front, 1, 4);
  expect(gridSelector).toMatchSnapshot();
});

test("the html structure of a CardSlot's grid selector, cards grouped together", async () => {
  server.use(
    cardDocumentsFourResults,
    sourceDocumentsThreeResults,
    searchResultsFourResults
  );

  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage1,
      viewSettings: {
        frontsVisible: true,
        facetBySource: false,
        sourcesVisible: {},
      },
    },
  });

  const gridSelector = await openCardSlotGridSelector(1, Front, 1, 4);
  expect(gridSelector).toMatchSnapshot();
});

//# endregion

test("switching to the next image in a CardSlot", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage1,
    },
  });

  // from preloaded state
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 3);

  screen.getByText("❯").click();

  await expectCardGridSlotState(1, Front, cardDocument2.name, 2, 3);
});

test("switching to the previous image in a CardSlot", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage2,
    },
  });

  // from preloaded state
  await expectCardGridSlotState(1, Front, cardDocument2.name, 2, 3);

  screen.getByText("❮").click();

  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 3);
});

test("switching images in a CardSlot wraps around", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage2,
    },
  });

  // from preloaded state
  await expectCardGridSlotState(1, Front, cardDocument2.name, 2, 3);

  // page between images and ensure that wrapping around works
  screen.getByText("❯").click();
  await expectCardGridSlotState(1, Front, cardDocument3.name, 3, 3);

  screen.getByText("❯").click();
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 3);

  screen.getByText("❮").click();
  await expectCardGridSlotState(1, Front, cardDocument3.name, 3, 3);
});

test("selecting an image in a CardSlot via the grid selector", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage2,
    },
  });

  // from preloaded state
  await expectCardGridSlotState(1, Front, cardDocument2.name, 2, 3);

  await waitFor(() => screen.getByText("2 / 3").click());
  await waitFor(() => expect(screen.getByText("Select Version")));

  expect(screen.getByText("Option 2")).toBeInTheDocument();
  expect(screen.getByText("Option 3")).toBeInTheDocument();
  screen.getByText("Option 1").click();

  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 3);
});

test("deleting a CardSlot", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage1,
    },
  });
  await waitFor(() =>
    expect(screen.getByText(cardDocument1.name)).toBeInTheDocument()
  );

  screen.getByLabelText("remove-front0").click();

  await expectCardSlotToNotExist(1);
});

test("deleting multiple CardSlots", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectThreeMembersSelectedImage1,
    },
  });
  await waitFor(() =>
    expect(screen.getAllByText(cardDocument1.name)).toHaveLength(3)
  );

  screen.getByLabelText("remove-front0").click();
  screen.getByLabelText("remove-front1").click();

  await expectCardSlotToNotExist(2);
  await expectCardSlotToNotExist(3);
});

test("CardSlot automatically selects the first search result", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [
          {
            front: {
              query: { query: "my search query", card_type: Card },
              selectedImage: null,
            },
            back: null,
          },
        ],
        cardback: null,
      },
    },
  });

  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 3);
});

test("CardSlot automatically deselects invalid image then selects the first search result", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage2, // not in search results
    },
  });

  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
});

test("CardSlot uses cardbacks as search results for backs with no search query", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoResults,
    sourceDocumentsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [
          {
            front: null,
            back: {
              query: null,
              selectedImage: cardDocument1.identifier,
            },
          },
        ],
        cardback: null,
      },
    },
  });

  await expectCardGridSlotState(1, Back, cardDocument1.name, 1, 2);
  await expectCardbackSlotState(cardDocument1.name, 1, 2);
});

test("CardSlot defaults to project cardback for backs with no search query", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoResults,
    sourceDocumentsOneResult,
    ...defaultHandlers
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [
          {
            front: null,
            back: null,
          },
        ],
        cardback: cardDocument1.identifier,
      },
    },
  });

  await expectCardGridSlotState(1, Back, cardDocument1.name, 1, 2);
  await expectCardbackSlotState(cardDocument1.name, 1, 2);
});

test("double clicking the select button selects all slots for the same query", async () => {
  server.use(
    cardDocumentsOneResult,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: {
        members: [
          {
            front: {
              query: { query: "my search query", card_type: Card },
              selectedImage: null,
            },
            back: null,
          },
          {
            front: {
              query: { query: "my search query", card_type: Card },
              selectedImage: null,
            },
            back: null,
          },
        ],
        cardback: null,
      },
    },
  });
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);
  await expectCardGridSlotState(2, Front, cardDocument1.name, 1, 1);

  await selectSlot(1, Front);
  await selectSlot(1, Front, 2);
  await waitFor(() =>
    expect(screen.getByLabelText("select-front0").firstChild).toHaveClass(
      "bi-check-square"
    )
  );
  await waitFor(() =>
    expect(screen.getByLabelText("select-front1").firstChild).toHaveClass(
      "bi-check-square"
    )
  );
});
