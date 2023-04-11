import { renderWithProviders } from "@/common/test-utils";
import { CardSlot } from "@/features/card/cardSlot";
import { screen, waitFor } from "@testing-library/react";
import { Front, Back, Card } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocumentsOneResult,
  cardDocumentsThreeResults,
  searchResultsOneResult,
  searchResultsThreeResults,
  projectSelectedImage1,
  projectSelectedImage2,
} from "@/common/test-constants";

//# region snapshot tests

test("the html structure of a CardSlot with a single search result, no image selected", () => {
  const rendered = renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsOneResult,
        searchResults: searchResultsOneResult,
      },
    }
  );
  expect(rendered.baseElement).toMatchSnapshot();
});

test("the html structure of a CardSlot with a single search result, image selected", () => {
  const rendered = renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsOneResult,
        searchResults: searchResultsOneResult,
        project: projectSelectedImage1,
      },
    }
  );
  expect(rendered.baseElement).toMatchSnapshot();
});

test("the html structure of a CardSlot with multiple search results, image selected", () => {
  const rendered = renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsThreeResults,
        project: projectSelectedImage1,
      },
    }
  );
  expect(rendered.baseElement).toMatchSnapshot();
});

test("the html structure of a CardSlot's grid selector", async () => {
  const rendered = renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsThreeResults,
        project: projectSelectedImage1,
      },
    }
  );
  screen.getByText("1 / 3").click();
  await waitFor(() => expect(screen.getByText("Select Version")));
  // this is a bit hacky, but i'm not sure how else to identify the whole modal with RTL
  expect(document.getElementsByClassName("modal-lg")[0]).toMatchSnapshot();
});

//# endregion

test("switching to the next image in a CardSlot", async () => {
  renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsThreeResults,
        project: projectSelectedImage1,
      },
    }
  );
  expect(screen.getByText("1 / 3")).toBeInTheDocument();
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();

  screen.getByText("❯").click();
  await waitFor(() => expect(screen.getByText("2 / 3")).toBeInTheDocument());
  expect(screen.getByText(cardDocument2.name)).toBeInTheDocument();
});

test("switching to the previous image in a CardSlot", async () => {
  renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsThreeResults,
        project: projectSelectedImage2,
      },
    }
  );
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
  expect(screen.getByText(cardDocument2.name)).toBeInTheDocument();

  screen.getByText("❮").click();
  await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();
});

test("switching images in a CardSlot wraps around", async () => {
  renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsThreeResults,
        project: projectSelectedImage2,
      },
    }
  );
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
  expect(screen.getByText(cardDocument2.name)).toBeInTheDocument();

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
  renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsThreeResults,
        project: projectSelectedImage2,
      },
    }
  );

  screen.getByText("2 / 3").click();
  await waitFor(() => expect(screen.getByText("Select Version")));

  expect(screen.getByText("Option 2")).toBeInTheDocument();
  expect(screen.getByText("Option 3")).toBeInTheDocument();
  screen.getByText("Option 1").click();

  await waitFor(() => {
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
});

test("deleting a CardSlot", async () => {
  renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsThreeResults,
        project: projectSelectedImage1,
      },
    }
  );
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();

  screen.getByLabelText("remove-front0").click();
  await waitFor(() => {
    expect(screen.queryByText(cardDocument1.name)).not.toBeInTheDocument();
  });
});

test("CardSlot automatically selects the first search result", async () => {
  renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      // no `project` state given -> nothing selected
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsThreeResults,
      },
    }
  );

  await waitFor(() => {
    expect(screen.queryByText(cardDocument1.name)).toBeInTheDocument();
  });
});

test("CardSlot automatically deselects invalid image then selects the first search result", async () => {
  renderWithProviders(
    <CardSlot
      searchQuery={{ query: "my search query", card_type: Card }}
      slot={0}
      face={Front}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        searchResults: searchResultsOneResult,
        project: projectSelectedImage2, // not in search results
      },
    }
  );

  await waitFor(() => {
    expect(screen.queryByText(cardDocument1.name)).toBeInTheDocument();
  });
});

test("CardSlot uses cardbacks as search results for backs with no search query", async () => {
  renderWithProviders(
    <CardSlot
      searchQuery={undefined}
      slot={0}
      face={Back}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
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
        cardbacks: {
          cardbacks: [cardDocument1.identifier, cardDocument2.identifier],
          status: "idle",
          error: null,
        },
      },
    }
  );

  await waitFor(() =>
    expect(screen.queryByText(cardDocument1.name)).toBeInTheDocument()
  );
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
});

test("CardSlot defaults to project cardback for backs with no search query", async () => {
  renderWithProviders(
    <CardSlot
      searchQuery={undefined}
      slot={0}
      face={Back}
      handleShowDetailedView={() => {}}
    />,
    {
      preloadedState: {
        cardDocuments: cardDocumentsThreeResults,
        project: {
          members: [
            {
              front: null,
              back: null,
            },
          ],
          cardback: cardDocument1.identifier,
        },
        cardbacks: {
          cardbacks: [cardDocument1.identifier, cardDocument2.identifier],
          status: "idle",
          error: null,
        },
      },
    }
  );

  await waitFor(() =>
    expect(screen.queryByText(cardDocument1.name)).toBeInTheDocument()
  );
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
});
