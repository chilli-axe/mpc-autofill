import { screen, waitFor } from "@testing-library/react";

import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  sourceDocument1,
} from "@/common/test-constants";
import { renderWithProviders } from "@/common/test-utils";
import { NewCards } from "@/features/new/new";
import {
  defaultHandlers,
  newCardsFirstPageNoResults,
  newCardsFirstPageWithTwoSources,
  newCardsPageForSource1,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

test("the html structure of the new cards page with two sources, each with result/s", async () => {
  server.use(newCardsFirstPageWithTwoSources, ...defaultHandlers);
  const rendered = renderWithProviders(<NewCards />);
  await waitFor(() =>
    expect(screen.getByText(sourceDocument1.name)).toBeInTheDocument()
  );
  expect(
    screen.getByText("Check out the new cards", { exact: false }).parentElement!
  ).toMatchSnapshot();
});

test("the html structure of the new cards page with no data", async () => {
  server.use(newCardsFirstPageNoResults, ...defaultHandlers);
  const rendered = renderWithProviders(<NewCards />);
  await waitFor(() =>
    expect(screen.getByText(":(", { exact: false })).toBeInTheDocument()
  );
  expect(
    screen.getByText(":(", { exact: false }).parentElement!
  ).toMatchSnapshot();
});

test("clicking to show another page of results in the new cards page", async () => {
  server.use(
    newCardsFirstPageWithTwoSources,
    newCardsPageForSource1,
    ...defaultHandlers
  );
  renderWithProviders(<NewCards />);
  await waitFor(() =>
    expect(screen.getByText(sourceDocument1.name)).toBeInTheDocument()
  );
  expect(screen.getByText(cardDocument1.name)).toBeInTheDocument();
  expect(screen.getByText(cardDocument2.name)).toBeInTheDocument();
  expect(screen.queryByText(cardDocument3.name)).not.toBeInTheDocument();
  expect(screen.queryByText(cardDocument4.name)).not.toBeInTheDocument();

  screen.getByText("Load More").click();

  await waitFor(() =>
    expect(screen.getByText(cardDocument3.name)).toBeInTheDocument()
  );
  expect(screen.getByText(cardDocument4.name)).toBeInTheDocument();
  expect(screen.queryByText("Load More")).not.toBeInTheDocument();
});
