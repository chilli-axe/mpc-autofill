import { server } from "@/mocks/server";
import {
  cardDocumentsThreeResults,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import {
  renderWithProviders,
  openCardSlotGridSelector,
} from "@/common/test-utils";
import App from "@/app/app";
import {
  localBackend,
  projectSelectedImage1,
  sourceDocument1,
} from "@/common/test-constants";
import { Front } from "@/common/constants";
import { waitFor, within } from "@testing-library/react";

test("toggling between faceting cards by source vs grouped together works as expected", async () => {
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

  const gridSelector = await openCardSlotGridSelector(1, Front, 1, 3);
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.name}-collapse`)
    ).toBeInTheDocument()
  );

  within(gridSelector).getByText("Facet By Source").click();
  await waitFor(() =>
    expect(
      within(gridSelector).queryByTestId(`${sourceDocument1.name}-collapse`)
    ).not.toBeInTheDocument()
  );
});

test("collapsing a source in the faceted view then expanding it works as expected", async () => {
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

  const gridSelector = await openCardSlotGridSelector(1, Front, 1, 3);
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.name}-collapse`)
    ).toHaveClass("show")
  );

  within(gridSelector)
    .getByTestId(`${sourceDocument1.name}-collapse-header`)
    .click();
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.name}-collapse`)
    ).not.toHaveClass("show")
  );

  within(gridSelector)
    .getByTestId(`${sourceDocument1.name}-collapse-header`)
    .click();
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.name}-collapse`)
    ).toHaveClass("show")
  );
});

test("collapsing and expanding all sources works as expected", async () => {
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

  const gridSelector = await openCardSlotGridSelector(1, Front, 1, 3);
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.name}-collapse`)
    ).toHaveClass("show")
  );

  within(gridSelector).getByText("Collapse All").click();
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.name}-collapse`)
    ).not.toHaveClass("show")
  );

  within(gridSelector).getByText("Expand All").click();
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.name}-collapse`)
    ).toHaveClass("show")
  );
});
