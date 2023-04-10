import { renderWithProviders } from "@/common/test-utils";
import { CardSlot } from "@/features/card/cardSlot";
import { screen, render, waitFor } from "@testing-library/react";
import { Front, Card } from "@/common/constants";
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
import About from "@/pages/about";

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
  await waitFor(() => {
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
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
  await waitFor(() => {
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
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
  await waitFor(() => {
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });
  expect(screen.getByText(cardDocument3.name)).toBeInTheDocument();

  screen.getByText("❯").click();
  await waitFor(() => {
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();

  screen.getByText("❮").click();
  await waitFor(() => {
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });
  expect(screen.getByText(cardDocument3.name)).toBeInTheDocument();
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
