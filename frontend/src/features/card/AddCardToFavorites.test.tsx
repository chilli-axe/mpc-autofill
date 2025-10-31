import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { cardDocument1 } from "@/common/test-constants";
import { renderWithProviders } from "@/common/test-utils";
import { AddCardToFavorites } from "@/features/card/AddCardToFavorites";
import { defaultHandlers } from "@/mocks/handlers";
import { server } from "@/mocks/server";

describe("AddCardToFavorites tests", () => {
  beforeEach(() => {
    server.use(...defaultHandlers);
  });

  test("renders Add to Favorites button when card is not a favorite", () => {
    renderWithProviders(<AddCardToFavorites cardDocument={cardDocument1} />, {
      preloadedState: {
        favorites: {
          favoriteRenders: {},
        },
        toasts: {
          notifications: {},
        },
      },
    });

    const button = screen.getByRole("button", { name: /Add to Favorites/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("btn-outline-info");
  });

  test("renders Remove from Favorites button when card is already a favorite", () => {
    renderWithProviders(<AddCardToFavorites cardDocument={cardDocument1} />, {
      preloadedState: {
        favorites: {
          favoriteRenders: {
            [cardDocument1.searchq]: [cardDocument1.identifier],
          },
        },
        toasts: {
          notifications: {},
        },
      },
    });

    const button = screen.getByRole("button", {
      name: /Remove from Favorites/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("btn-info");
  });

  test("adding card to favorites", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddCardToFavorites cardDocument={cardDocument1} />, {
      preloadedState: {
        favorites: {
          favoriteRenders: {},
        },
        toasts: {
          notifications: {},
        },
      },
    });

    // Initially shows "Add to Favorites"
    const button = screen.getByRole("button", { name: /Add to Favorites/i });
    expect(button).toBeInTheDocument();

    // Click the button
    await user.click(button);

    // Should update to show "Remove from Favorites"
    await waitFor(() => {
      expect(
        screen.getByText("Remove from Favorites", { exact: false })
      ).toBeInTheDocument();
    });

    // Should show notification
    await waitFor(() => {
      expect(
        screen.getByText("Added to Favorites", { exact: false })
      ).toBeInTheDocument();
      expect(
        screen.getByText(`Added ${cardDocument1.name} to your favorites!`)
      ).toBeInTheDocument();
    });

    // Button should have info variant
    expect(button).toHaveClass("btn-info");
  });

  test("removing card from favorites", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddCardToFavorites cardDocument={cardDocument1} />, {
      preloadedState: {
        favorites: {
          favoriteRenders: {
            [cardDocument1.searchq]: [cardDocument1.identifier],
          },
        },
        toasts: {
          notifications: {},
        },
      },
    });

    // Initially shows "Remove from Favorites"
    const button = screen.getByRole("button", {
      name: /Remove from Favorites/i,
    });
    expect(button).toBeInTheDocument();

    // Click the button
    await user.click(button);

    // Should update to show "Add to Favorites"
    await waitFor(() => {
      expect(
        screen.getByText("Add to Favorites", { exact: false })
      ).toBeInTheDocument();
    });

    // Should show notification
    await waitFor(() => {
      expect(
        screen.getByText("Removed from Favorites", { exact: false })
      ).toBeInTheDocument();
      expect(
        screen.getByText(`Removed ${cardDocument1.name} from your favorites.`)
      ).toBeInTheDocument();
    });

    // Button should have outline-info variant
    expect(button).toHaveClass("btn-outline-info");
  });

  test("toggling favorite status multiple times", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddCardToFavorites cardDocument={cardDocument1} />, {
      preloadedState: {
        favorites: {
          favoriteRenders: {},
        },
        toasts: {
          notifications: {},
        },
      },
    });

    // First click: Add to favorites
    let button = screen.getByRole("button", { name: /Add to Favorites/i });
    await user.click(button);
    await waitFor(() => {
      expect(
        screen.getByText("Remove from Favorites", { exact: false })
      ).toBeInTheDocument();
    });

    // Second click: Remove from favorites
    button = screen.getByRole("button", { name: /Remove from Favorites/i });
    await user.click(button);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Add to Favorites/i })
      ).toBeInTheDocument();
    });

    // Third click: Add to favorites again
    button = screen.getByRole("button", { name: /Add to Favorites/i });
    await user.click(button);
    await waitFor(() => {
      expect(
        screen.getByText("Remove from Favorites", { exact: false })
      ).toBeInTheDocument();
    });
  });
});
