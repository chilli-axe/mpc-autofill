import { renderWithProviders } from "@/common/test-utils";
import { screen, waitFor } from "@testing-library/react";
import { Card } from "@/common/constants";
import {
  localBackend,
  cardDocument1,
  cardDocument2,
  cardDocument3,
  projectSelectedImage1,
  projectSelectedImage2,
} from "@/common/test-constants";
import {
  cardDocumentsOneResult,
  cardDocumentsThreeResults,
  cardbacksTwoResults,
  sourceDocumentsOneResult,
  searchResultsOneResult,
  searchResultsThreeResults,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";
import App from "@/app/app";

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
  await waitFor(() =>
    expect(screen.queryAllByText(cardDocument1.name)).toHaveLength(1)
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
  await waitFor(() =>
    expect(screen.queryAllByText(cardDocument1.name)).toHaveLength(1)
  );
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
  await waitFor(() =>
    expect(screen.queryAllByText(cardDocument1.name)).toHaveLength(1)
  );
  expect(screen.getByTestId("front-slot0")).toMatchSnapshot();
});

test("the html structure of a CardSlot's grid selector", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults
  );

  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage1,
    },
  });
  await waitFor(() =>
    expect(screen.queryAllByText(cardDocument1.name)).toHaveLength(1)
  );
  await waitFor(() => screen.getByText("1 / 3").click());
  await waitFor(() => expect(screen.getByText("Select Version")));
  // this is a bit hacky, but i'm not sure how else to identify the whole modal with RTL
  // expect(document.getElementsByClassName("modal-lg")[0]).toMatchSnapshot();
  expect(screen.getByTestId("front-slot0-grid-selector")).toMatchSnapshot();
});

//# endregion

test("switching to the next image in a CardSlot", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage1,
    },
  });
  await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
  await waitFor(() =>
    expect(screen.getByText(cardDocument1.name)).toBeInTheDocument()
  );

  screen.getByText("❯").click();
  await waitFor(() => expect(screen.getByText("2 / 3")).toBeInTheDocument());
  expect(screen.getByText(cardDocument2.name)).toBeInTheDocument();
});

test("switching to the previous image in a CardSlot", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage2,
    },
  });
  await waitFor(() => expect(screen.getByText("2 / 3")).toBeInTheDocument());
  await waitFor(() =>
    expect(screen.getByText(cardDocument2.name)).toBeInTheDocument()
  );

  screen.getByText("❮").click();
  await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();
});

test("switching images in a CardSlot wraps around", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage2,
    },
  });
  await waitFor(() => expect(screen.getByText("2 / 3")).toBeInTheDocument());
  await waitFor(() =>
    expect(screen.getByText(cardDocument2.name)).toBeInTheDocument()
  );

  screen.getByText("❯").click();
  await waitFor(() => expect(screen.getByText("3 / 3")).toBeInTheDocument());
  expect(screen.getByText(cardDocument3.name)).toBeInTheDocument();

  screen.getByText("❯").click();
  await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();

  screen.getByText("❮").click();
  await waitFor(() => expect(screen.getByText("3 / 3")).toBeInTheDocument());
  expect(screen.getByText(cardDocument3.name)).toBeInTheDocument();
});

test("selecting an image in a CardSlot via the grid selector", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage2,
    },
  });

  await waitFor(() => screen.getByText("2 / 3").click());
  await waitFor(() => expect(screen.getByText("Select Version")));

  expect(screen.getByText("Option 2")).toBeInTheDocument();
  expect(screen.getByText("Option 3")).toBeInTheDocument();
  screen.getByText("Option 1").click();

  await waitFor(() => {
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
});

test("deleting a CardSlot", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults
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
  await waitFor(() => {
    expect(screen.queryByText(cardDocument1.name)).not.toBeInTheDocument();
  });
});

test("CardSlot automatically selects the first search result", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults
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

  await waitFor(() => {
    expect(screen.queryByText(cardDocument1.name)).toBeInTheDocument();
  });
});

test("CardSlot automatically deselects invalid image then selects the first search result", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsOneResult
  );
  renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: projectSelectedImage2, // not in search results
    },
  });

  await waitFor(() => {
    expect(screen.queryByText(cardDocument1.name)).toBeInTheDocument();
  });
});

test("CardSlot uses cardbacks as search results for backs with no search query", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoResults,
    sourceDocumentsOneResult
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

  await waitFor(() =>
    expect(screen.getAllByText(cardDocument1.name)).toHaveLength(2)
  );
  expect(screen.getAllByText("1 / 2")).toHaveLength(2);
});

test("CardSlot defaults to project cardback for backs with no search query", async () => {
  server.use(
    cardDocumentsThreeResults,
    cardbacksTwoResults,
    sourceDocumentsOneResult
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

  await waitFor(() =>
    expect(screen.queryAllByText(cardDocument1.name)).toHaveLength(2)
  );
  expect(screen.getAllByText("1 / 2")).toHaveLength(2);
});
